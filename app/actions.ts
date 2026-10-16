"use server";

import { findDuplicateCandidates } from "@/lib/duplicateDetection";
import { draftFromExtraction } from "@/lib/extractor";
import { cleanJobIdentityFields } from "@/lib/field-noise";
import { extractJobFromText } from "@/lib/text-extractor";
import {
  archiveJobRecord,
  deleteJobRecord,
  getDailyGoalsState,
  getPotentialDuplicateCandidates,
  getSearchCycles,
  insertJob,
  matchEmailAgainstActiveRecords,
  updateComments,
  updateDailyGoalState,
  updateJobStage
} from "@/lib/server/job-actions-helpers";
import {
  revalidateAfterActiveRecordArchived,
  revalidateAfterActiveRecordDeleted,
  revalidateAfterActiveRecordSaved,
  revalidateAfterCommentsUpdated,
  revalidateAfterDailyGoalsUpdated,
  revalidateAfterStageUpdated
} from "@/lib/server/revalidation";
import { assertReadAllowed, getWriteBlock } from "@/lib/server/auth";
import {
  resolveSearchCycleLabel,
  type SearchCycleBoundary
} from "@/lib/search-cycle";
import type {
  DailyGoalsState,
  DuplicateCandidate,
  EmailMatch,
  GoalKey,
  JobDraft,
  JobStage,
  JobRecord
} from "@/lib/types";
import { createId, normalizeLocationForStorage } from "@/lib/utils";

function createRecordFromDraft(
  draft: JobDraft,
  cycles: readonly SearchCycleBoundary[]
): JobRecord {
  const confirmedOrigins = Object.values(draft.fieldOrigins).every(
    (value) => value === "confirmed"
  );
  const timestamp = new Date().toISOString();
  // Last safety net for scraped noise (HTML entities, posting metadata glued
  // onto the location, flattened acronyms) regardless of which extractor or
  // review path produced the draft.
  const identity = cleanJobIdentityFields({
    company: draft.company,
    roleTitle: draft.roleTitle,
    location: draft.location
  });

  return {
    id: createId(),
    roleTitle: identity.roleTitle,
    company: identity.company,
    location: normalizeLocationForStorage(identity.location),
    link: draft.link,
    jobDescription: draft.jobDescription,
    timestamp,
    pool: "active",
    stage: "no_response",
    searchCycleLabel: resolveSearchCycleLabel(timestamp, cycles),
    comments: "",
    applyCountedDateKey: null,
    sourceType: draft.sourceType,
    sourceConfidence: draft.sourceConfidence,
    extractionStatus: confirmedOrigins ? "confirmed" : "needs_review"
  };
}

export type CreateJobResult =
  | { status: "review"; draft: JobDraft }
  | { status: "duplicate"; draft: JobDraft; candidates: DuplicateCandidate[] }
  | { status: "saved"; record: JobRecord }
  | { status: "blocked"; message: string };

export type WriteActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type DailyGoalActionResult =
  | { ok: true; state: DailyGoalsState }
  | { ok: false; error: string };

export async function createJobFromLink(rawUrl: string): Promise<CreateJobResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { status: "blocked", message: blocked.message };
  }

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

  const record = createRecordFromDraft(draft, await getSearchCycles());
  await insertJob(record);
  revalidateAfterActiveRecordSaved(record.id);
  return { status: "saved", record };
}

export async function createJobFromText(rawText: string): Promise<CreateJobResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { status: "blocked", message: blocked.message };
  }

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

  const record = createRecordFromDraft(draft, await getSearchCycles());
  await insertJob(record);
  revalidateAfterActiveRecordSaved(record.id);
  return { status: "saved", record };
}

export async function saveReviewedJob(
  draft: JobDraft,
  allowDuplicate = false
): Promise<CreateJobResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { status: "blocked", message: blocked.message };
  }

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

  const record = createRecordFromDraft(draft, await getSearchCycles());
  await insertJob(record);
  revalidateAfterActiveRecordSaved(record.id);
  return { status: "saved", record };
}

export async function updateJobComments(
  id: string,
  comments: string
): Promise<WriteActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  await updateComments(id, comments);
  revalidateAfterCommentsUpdated(id);
  return { ok: true };
}

export async function updateActiveJobStage(
  id: string,
  stage: JobStage
): Promise<WriteActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  await updateJobStage(id, stage);
  revalidateAfterStageUpdated(id);
  return { ok: true };
}

export async function archiveJobToRejected(id: string): Promise<WriteActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  await archiveJobRecord(id);
  revalidateAfterActiveRecordArchived();
  return { ok: true };
}

export async function deleteJobPermanently(id: string): Promise<WriteActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  await deleteJobRecord(id);
  revalidateAfterActiveRecordDeleted();
  return { ok: true };
}

export async function updateDailyGoal(input: {
  goal: GoalKey;
  kind: "increment" | "target";
  value?: number;
}): Promise<DailyGoalActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  const next = await updateDailyGoalState(input);
  revalidateAfterDailyGoalsUpdated();
  return { ok: true, state: next };
}

export async function matchRejectionEmail(
  emailText: string
): Promise<EmailMatch[]> {
  await assertReadAllowed();
  return matchEmailAgainstActiveRecords(emailText);
}
