import { jobStageOrder, normalizeJobStage } from "@/lib/job-stage";
import {
  normalizeSearchCycleLabel,
  sortSearchCyclesByStart,
  type SearchCycleBoundary
} from "@/lib/search-cycle";
import type {
  InterviewedCompany,
  JobPool,
  JobStage,
  SearchLogAnalytics,
  SearchLogStageBucket
} from "@/lib/types";

export type SearchLogAnalyticsRow = {
  timestamp: string;
  pool: JobPool;
  stage: JobStage;
  searchCycleLabel: string | null;
  company: string;
};

const stageRank = new Map(jobStageOrder.map((stage, index) => [stage, index]));

function companyKey(company: string) {
  return company.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The companies a cycle interviewed with, computed from its records: every
 * record whose furthest stage is past no_response / rejected, one entry per
 * company (the furthest stage any of its applications reached), furthest
 * stage first and then by name.
 */
export function buildInterviewedCompanies(
  rows: ReadonlyArray<Pick<SearchLogAnalyticsRow, "company" | "stage">>
): InterviewedCompany[] {
  const byCompany = new Map<string, InterviewedCompany>();

  for (const row of rows) {
    if (row.stage === "no_response" || row.stage === "rejected") {
      continue;
    }

    const company = row.company.trim();
    if (!company) {
      continue;
    }

    const key = companyKey(company);
    const existing = byCompany.get(key);
    if (
      !existing ||
      (stageRank.get(row.stage) ?? -1) > (stageRank.get(existing.stage) ?? -1)
    ) {
      byCompany.set(key, { company, stage: row.stage });
    }
  }

  return Array.from(byCompany.values()).sort(
    (left, right) =>
      (stageRank.get(right.stage) ?? -1) - (stageRank.get(left.stage) ?? -1) ||
      left.company.localeCompare(right.company, "en", { sensitivity: "base" })
  );
}

function compareSearchCycleLabels(left: string, right: string) {
  const leftNumber = Number(left.match(/\d+/)?.[0] ?? Number.NaN);
  const rightNumber = Number(right.match(/\d+/)?.[0] ?? Number.NaN);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right);
}

/**
 * Cycles the table knows come first, oldest start date first; labels that only
 * appear on records (a label typed before its cycle row existed) follow in
 * label-number order.
 */
function compareCycleLabels(
  cycles: readonly SearchCycleBoundary[]
): (left: string, right: string) => number {
  const order = new Map(
    sortSearchCyclesByStart(cycles).map((cycle, index) => [cycle.label, index])
  );

  return (left, right) => {
    const leftOrder = order.get(left);
    const rightOrder = order.get(right);
    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) {
      return -1;
    }
    if (rightOrder !== undefined) {
      return 1;
    }
    return compareSearchCycleLabels(left, right);
  };
}

export function buildSearchLogAnalyticsFromRows(
  rows: SearchLogAnalyticsRow[],
  cycles: readonly SearchCycleBoundary[]
): SearchLogAnalytics {
  const bucketMap = new Map<string, SearchLogStageBucket>();
  const totals = new Map<string, number>();
  const rowsByLabel = new Map<string, SearchLogAnalyticsRow[]>();

  for (const row of rows) {
    const label = normalizeSearchCycleLabel(
      row.searchCycleLabel,
      row.timestamp,
      cycles
    );
    const stage = normalizeJobStage(row.stage, row.pool);
    rowsByLabel.set(label, [...(rowsByLabel.get(label) ?? []), { ...row, stage }]);
    const key = `${label}\u0000${row.pool}\u0000${stage}`;
    const current = bucketMap.get(key);

    if (current) {
      current.count += 1;
    } else {
      bucketMap.set(key, {
        searchCycleLabel: label,
        pool: row.pool,
        stage,
        count: 1
      });
    }

    totals.set(label, (totals.get(label) ?? 0) + 1);
  }

  const compare = compareCycleLabels(cycles);
  const cycleAnalytics = Array.from(totals.entries())
    .sort(([left], [right]) => compare(left, right))
    .map(([label, total]) => ({
      label,
      total,
      interviewedCompanies: buildInterviewedCompanies(rowsByLabel.get(label) ?? []),
      buckets: Array.from(bucketMap.values())
        .filter((bucket) => bucket.searchCycleLabel === label)
        .sort((left, right) => {
          if (left.pool !== right.pool) {
            return left.pool.localeCompare(right.pool);
          }

          return left.stage.localeCompare(right.stage);
        })
    }));

  return { cycles: cycleAnalytics };
}
