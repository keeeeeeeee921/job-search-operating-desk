"use server";

import { findDuplicateCandidates } from "@/lib/duplicateDetection";
import { draftFromExtraction } from "@/lib/extractor";
import { extractJobFromText } from "@/lib/text-extractor";
import {
  archiveJobRecord,
  deleteJobRecord,
  getDailyGoalsState,
  getPotentialDuplicateCandidates,
  insertJob,
  matchEmailAgainstActiveRecords,
  updateComments,
  updateDailyGoalState
} from "@/lib/server/job-actions-helpers";
import {
  revalidateAfterActiveRecordRemoved,
  revalidateAfterActiveRecordSaved,
  revalidateAfterCommentsUpdated,
  revalidateAfterDailyGoalsUpdated
} from "@/lib/server/revalidation";
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
    applyCountedDateKey: null,
    sourceType: draft.sourceType,
    sourceConfidence: draft.sourceConfidence,
    extractionStatus: confirmedOrigins ? "confirmed" : "needs_review"
  };
}

type CreateJobResult =
  | { status: "review"; draft: JobDraft }
  | { status: "duplicate"; draft: JobDraft; candidates: DuplicateCandidate[] }
  | { status: "saved"; record: JobRecord };

export async function createJobFromLink(rawUrl: string): Promise<CreateJobResult> {
  const { extractJobOnServer } = await import("@/lib/server/extraction-service");
  const extraction = await extractJobOnServer(rawUrl);
  const draft = draftFromExtraction(extraction);

  if (draft.issues.length > 0) {
    return { status: "review", draft };
  }

  const duplicatePool = await getPotentialDuplicateCandidates({
    company: draft.company,
    roleTitle: draft.roleTitle,
    link: draft.link,
    limit: 120,
    sinceDays: 365
  });
  const candidates = findDuplicateCandidates(draft, duplicatePool);
  if (candidates.length > 0) {
    return { status: "duplicate", draft, candidates };
  }

  const record = createRecordFromDraft(draft);
  await insertJob(record);
  revalidateAfterActiveRecordSaved(record.id);
  return { status: "saved", record };
}

export async function createJobFromText(rawText: string): Promise<CreateJobResult> {
  const extraction = extractJobFromText(rawText);
  const draft = draftFromExtraction(extraction);

  if (draft.issues.length > 0) {
    return { status: "review", draft };
  }

  const duplicatePool = await getPotentialDuplicateCandidates({
    company: draft.company,
    roleTitle: draft.roleTitle,
    link: draft.link,
    limit: 120,
    sinceDays: 365
  });
  const candidates = findDuplicateCandidates(draft, duplicatePool);
  if (candidates.length > 0) {
    return { status: "duplicate", draft, candidates };
  }

  const record = createRecordFromDraft(draft);
  await insertJob(record);
  revalidateAfterActiveRecordSaved(record.id);
  return { status: "saved", record };
}

export async function saveReviewedJob(
  draft: JobDraft,
  allowDuplicate = false
): Promise<CreateJobResult> {
  const activeJobs = await getPotentialDuplicateCandidates({
    company: draft.company,
    roleTitle: draft.roleTitle,
    link: draft.link,
    limit: 120,
    sinceDays: 365
  });
  const candidates = allowDuplicate
    ? []
    : findDuplicateCandidates(draft, activeJobs);

  if (candidates.length > 0) {
    return { status: "duplicate", draft, candidates };
  }

  const record = createRecordFromDraft(draft);
  await insertJob(record);
  revalidateAfterActiveRecordSaved(record.id);
  return { status: "saved", record };
}

export async function updateJobComments(id: string, comments: string) {
  await updateComments(id, comments);
  revalidateAfterCommentsUpdated(id);
}

export async function archiveJobToRejected(id: string) {
  await archiveJobRecord(id);
  revalidateAfterActiveRecordRemoved(id);
}

export async function deleteJobPermanently(id: string) {
  await deleteJobRecord(id);
  revalidateAfterActiveRecordRemoved(id);
}

export async function updateDailyGoal(input: {
  goal: GoalKey;
  kind: "increment" | "target";
  value?: number;
}): Promise<DailyGoalsState> {
  const next = await updateDailyGoalState(input);
  revalidateAfterDailyGoalsUpdated();
  return next;
}

export async function matchRejectionEmail(
  emailText: string
): Promise<EmailMatch[]> {
  return matchEmailAgainstActiveRecords(emailText);
}
