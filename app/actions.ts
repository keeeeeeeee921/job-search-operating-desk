"use server";

import { revalidatePath } from "next/cache";
import { findDuplicateCandidates } from "@/lib/duplicateDetection";
import { draftFromExtraction } from "@/lib/extractor";
import { extractJobFromText } from "@/lib/text-extractor";
import {
  archiveJobRecord,
  deleteJobRecord,
  getDailyGoalsState,
  getJobsByPool,
  insertJob,
  matchEmailAgainstActiveRecords,
  updateComments,
  updateDailyGoalState
} from "@/lib/server/job-actions-helpers";
import type {
  DailyGoalsState,
  DuplicateCandidate,
  EmailMatch,
  GoalKey,
  JobDraft,
  JobRecord
} from "@/lib/types";
import { createId } from "@/lib/utils";

function createRecordFromDraft(draft: JobDraft): JobRecord {
  const confirmedOrigins = Object.values(draft.fieldOrigins).every(
    (value) => value === "confirmed"
  );

  return {
    id: createId(),
    roleTitle: draft.roleTitle,
    company: draft.company,
    location: draft.location,
    link: draft.link,
    jobDescription: draft.jobDescription,
    timestamp: new Date().toISOString(),
    pool: "active",
    comments: "",
    sourceType: draft.sourceType,
    sourceConfidence: draft.sourceConfidence,
    extractionStatus: confirmedOrigins ? "confirmed" : "needs_review"
  };
}

type CreateJobResult =
  | { status: "review"; draft: JobDraft }
  | { status: "duplicate"; draft: JobDraft; candidates: DuplicateCandidate[] }
  | { status: "saved"; record: JobRecord };

function revalidateAllJobViews(recordId?: string) {
  revalidatePath("/");
  revalidatePath("/active");
  revalidatePath("/search");
  revalidatePath("/rejected");
  revalidatePath("/update-by-email");
  if (recordId) {
    revalidatePath(`/active/${recordId}`);
  }
}

export async function createJobFromLink(rawUrl: string): Promise<CreateJobResult> {
  const { extractJobOnServer } = await import("@/lib/server/extraction-service");
  const extraction = await extractJobOnServer(rawUrl);
  const draft = draftFromExtraction(extraction);

  if (draft.issues.length > 0) {
    return { status: "review", draft };
  }

  const activeJobs = await getJobsByPool("active");
  const candidates = findDuplicateCandidates(draft, activeJobs);
  if (candidates.length > 0) {
    return { status: "duplicate", draft, candidates };
  }

  const record = createRecordFromDraft(draft);
  await insertJob(record);
  revalidateAllJobViews(record.id);
  return { status: "saved", record };
}

export async function createJobFromText(rawText: string): Promise<CreateJobResult> {
  const extraction = extractJobFromText(rawText);
  const draft = draftFromExtraction(extraction);

  if (draft.issues.length > 0) {
    return { status: "review", draft };
  }

  const activeJobs = await getJobsByPool("active");
  const candidates = findDuplicateCandidates(draft, activeJobs);
  if (candidates.length > 0) {
    return { status: "duplicate", draft, candidates };
  }

  const record = createRecordFromDraft(draft);
  await insertJob(record);
  revalidateAllJobViews(record.id);
  return { status: "saved", record };
}

export async function saveReviewedJob(
  draft: JobDraft,
  allowDuplicate = false
): Promise<CreateJobResult> {
  const activeJobs = await getJobsByPool("active");
  const candidates = allowDuplicate
    ? []
    : findDuplicateCandidates(draft, activeJobs);

  if (candidates.length > 0) {
    return { status: "duplicate", draft, candidates };
  }

  const record = createRecordFromDraft(draft);
  await insertJob(record);
  revalidateAllJobViews(record.id);
  return { status: "saved", record };
}

export async function updateJobComments(id: string, comments: string) {
  await updateComments(id, comments);
  revalidateAllJobViews(id);
}

export async function archiveJobToRejected(id: string) {
  await archiveJobRecord(id);
  revalidateAllJobViews(id);
}

export async function deleteJobPermanently(id: string) {
  await deleteJobRecord(id);
  revalidateAllJobViews(id);
}

export async function updateDailyGoal(input: {
  goal: GoalKey;
  kind: "increment" | "target";
  value?: number;
}): Promise<DailyGoalsState> {
  const next = await updateDailyGoalState(input);
  revalidatePath("/");
  return next;
}

export async function matchRejectionEmail(
  emailText: string
): Promise<EmailMatch[]> {
  return matchEmailAgainstActiveRecords(emailText);
}
