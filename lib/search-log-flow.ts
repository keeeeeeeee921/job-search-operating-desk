import type {
  JobPool,
  JobStage,
  SearchLogCycleAnalytics,
  SearchLogStageBucket
} from "@/lib/types";

/**
 * Turns one search cycle's pool × stage buckets into the funnel drawn on the
 * Search Log page:
 *
 *   Applied → { Screening / OA, Rejected before interview, No Response }
 *           → { Round 1, Dropped } → { Round 2+, Dropped } → { Offer, Dropped }
 *
 * A record's stage is the furthest stage it reached, so a record at round_2
 * counts in Screening / OA, Round 1 and Round 2+. Rejected records flow to
 * Dropped right after their furthest column; active records stop at their
 * furthest column and produce no Dropped flow.
 */

export type SearchLogFlowNodeId =
  | "applied"
  | "screening"
  | "rejected"
  | "no_response"
  | "round_1"
  | "dropped_1"
  | "round_2"
  | "dropped_2"
  | "offer"
  | "dropped_3";

export type SearchLogFlowColor =
  | "screening"
  | "round1"
  | "round2"
  | "offer"
  | "rejected"
  | "no_response";

export interface SearchLogFlowNode {
  id: SearchLogFlowNodeId;
  /** 0 = Applied, 1 = first outcome column, …, 4 = Offer column. */
  column: number;
  label: string;
  value: number;
  /** Rejected-before-interview and No Response: shrink to stubs in focus mode. */
  context: boolean;
  /** The node that toggles focus mode (Screening / OA). */
  focusable: boolean;
  /** Share of all applications in the cycle, 0–100 with one decimal. */
  pctOfApplied: number;
  /** Share of records that reached Screening / OA; null when nobody did. */
  pctOfScreened: number | null;
}

export interface SearchLogFlowLink {
  source: SearchLogFlowNodeId;
  target: SearchLogFlowNodeId;
  value: number;
  color: SearchLogFlowColor;
  context: boolean;
}

export interface SearchLogFlowCounts {
  applied: number;
  noResponse: number;
  rejectedBeforeInterview: number;
  screening: number;
  droppedAtScreening: number;
  round1: number;
  droppedAtRound1: number;
  round2Plus: number;
  droppedAtRound2Plus: number;
  offer: number;
}

export interface SearchLogFlow {
  label: string;
  counts: SearchLogFlowCounts;
  nodes: SearchLogFlowNode[];
  links: SearchLogFlowLink[];
}

export const searchLogFlowLabels: Record<SearchLogFlowNodeId, string> = {
  applied: "Applied",
  screening: "Screening / OA",
  rejected: "Rejected before interview",
  no_response: "No Response",
  round_1: "Round 1",
  dropped_1: "Dropped",
  round_2: "Round 2+",
  dropped_2: "Dropped",
  offer: "Offer",
  dropped_3: "Dropped"
};

/** Furthest funnel column a stage reaches: 0 = never past Applied. */
function furthestColumn(stage: JobStage): 0 | 1 | 2 | 3 | 4 {
  switch (stage) {
    case "screening_oa":
    case "unpaid":
      return 1;
    case "round_1":
      return 2;
    case "round_2":
    case "round_3":
    case "round_4":
    case "round_5":
      return 3;
    case "offer":
      return 4;
    default:
      return 0;
  }
}

export function percentOf(part: number, whole: number): number | null {
  if (!(whole > 0)) {
    return null;
  }

  return Math.round((part / whole) * 1000) / 10;
}

export function countSearchLogFlow(
  buckets: ReadonlyArray<Pick<SearchLogStageBucket, "pool" | "stage" | "count">>
): SearchLogFlowCounts {
  const counts: SearchLogFlowCounts = {
    applied: 0,
    noResponse: 0,
    rejectedBeforeInterview: 0,
    screening: 0,
    droppedAtScreening: 0,
    round1: 0,
    droppedAtRound1: 0,
    round2Plus: 0,
    droppedAtRound2Plus: 0,
    offer: 0
  };

  for (const bucket of buckets) {
    const n = bucket.count;
    if (!(n > 0)) {
      continue;
    }

    counts.applied += n;
    const column = furthestColumn(bucket.stage);
    const pool: JobPool = bucket.pool;

    if (column === 0) {
      if (pool === "active" && bucket.stage === "no_response") {
        counts.noResponse += n;
      } else {
        counts.rejectedBeforeInterview += n;
      }
      continue;
    }

    counts.screening += n;
    if (column >= 2) {
      counts.round1 += n;
    }
    if (column >= 3) {
      counts.round2Plus += n;
    }
    if (column >= 4) {
      counts.offer += n;
    }

    if (pool === "rejected") {
      if (column === 1) {
        counts.droppedAtScreening += n;
      } else if (column === 2) {
        counts.droppedAtRound1 += n;
      } else if (column === 3) {
        counts.droppedAtRound2Plus += n;
      }
    }
  }

  return counts;
}

export function buildSearchLogFlow(
  cycle: Pick<SearchLogCycleAnalytics, "label" | "buckets">
): SearchLogFlow {
  const counts = countSearchLogFlow(cycle.buckets);
  const { applied, screening } = counts;

  const node = (
    id: SearchLogFlowNodeId,
    column: number,
    value: number,
    options: { context?: boolean; focusable?: boolean } = {}
  ): SearchLogFlowNode => ({
    id,
    column,
    label: searchLogFlowLabels[id],
    value,
    context: options.context ?? false,
    focusable: options.focusable ?? false,
    pctOfApplied: percentOf(value, applied) ?? 0,
    pctOfScreened: percentOf(value, screening)
  });

  const nodes: SearchLogFlowNode[] = [
    node("applied", 0, applied),
    node("screening", 1, screening, { focusable: true }),
    node("rejected", 1, counts.rejectedBeforeInterview, { context: true }),
    node("no_response", 1, counts.noResponse, { context: true }),
    node("round_1", 2, counts.round1),
    node("dropped_1", 2, counts.droppedAtScreening),
    node("round_2", 3, counts.round2Plus),
    node("dropped_2", 3, counts.droppedAtRound1),
    node("offer", 4, counts.offer),
    node("dropped_3", 4, counts.droppedAtRound2Plus)
  ];

  const link = (
    source: SearchLogFlowNodeId,
    target: SearchLogFlowNodeId,
    value: number,
    color: SearchLogFlowColor,
    context = false
  ): SearchLogFlowLink => ({ source, target, value, color, context });

  const links: SearchLogFlowLink[] = [
    link("applied", "screening", screening, "screening"),
    link("applied", "rejected", counts.rejectedBeforeInterview, "rejected", true),
    link("applied", "no_response", counts.noResponse, "no_response", true),
    link("screening", "round_1", counts.round1, "round1"),
    link("screening", "dropped_1", counts.droppedAtScreening, "rejected"),
    link("round_1", "round_2", counts.round2Plus, "round2"),
    link("round_1", "dropped_2", counts.droppedAtRound1, "rejected"),
    link("round_2", "offer", counts.offer, "offer"),
    link("round_2", "dropped_3", counts.droppedAtRound2Plus, "rejected")
  ];

  return { label: cycle.label, counts, nodes, links };
}
