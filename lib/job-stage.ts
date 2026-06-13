import type { JobPool, JobStage } from "@/lib/types";

export const jobStageOrder: JobStage[] = [
  "no_response",
  "rejected",
  "screening_oa",
  "unpaid",
  "round_1",
  "round_2",
  "round_3",
  "round_4",
  "round_5",
  "offer"
];

export const jobStageLabels: Record<JobStage, string> = {
  no_response: "No Response",
  rejected: "Rejected",
  screening_oa: "Screening/OA",
  unpaid: "Unpaid",
  round_1: "Round 1",
  round_2: "Round 2",
  round_3: "Round 3",
  round_4: "Round 4",
  round_5: "Round 5",
  offer: "Offer"
};

export const selectableJobStages = jobStageOrder.filter(
  (stage) => stage !== "rejected"
);

const jobStageSet = new Set(jobStageOrder);

export function isJobStage(value: unknown): value is JobStage {
  return typeof value === "string" && jobStageSet.has(value as JobStage);
}

export function defaultStageForPool(pool: JobPool): JobStage {
  return pool === "rejected" ? "rejected" : "no_response";
}

export function normalizeJobStage(
  stage: unknown,
  pool: JobPool = "active"
): JobStage {
  return isJobStage(stage) ? stage : defaultStageForPool(pool);
}

export function stageAfterArchive(stage: JobStage): JobStage {
  return stage === "no_response" ? "rejected" : stage;
}
