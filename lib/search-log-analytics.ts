import { normalizeJobStage } from "@/lib/job-stage";
import { normalizeSearchCycleLabel } from "@/lib/search-cycle";
import type {
  JobPool,
  JobStage,
  SearchLogAnalytics,
  SearchLogStageBucket
} from "@/lib/types";

function subtractMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
}

function compareSearchCycleLabels(left: string, right: string) {
  const leftNumber = Number(left.match(/\d+/)?.[0] ?? Number.NaN);
  const rightNumber = Number(right.match(/\d+/)?.[0] ?? Number.NaN);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right);
}

export function buildSearchLogAnalyticsFromRows(
  rows: Array<{
    timestamp: string;
    pool: JobPool;
    stage: JobStage;
    searchCycleLabel: string | null;
  }>,
  sunkenMonths: number
): SearchLogAnalytics {
  const threshold = subtractMonths(new Date(), sunkenMonths);
  const bucketMap = new Map<string, SearchLogStageBucket>();
  const totals = new Map<string, number>();
  let sunkenActiveCount = 0;

  for (const row of rows) {
    const label = normalizeSearchCycleLabel(row.searchCycleLabel, row.timestamp);
    const stage = normalizeJobStage(row.stage, row.pool);
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

    if (row.pool === "active" && new Date(row.timestamp) <= threshold) {
      sunkenActiveCount += 1;
    }
  }

  const cycles = Array.from(totals.entries())
    .sort(([left], [right]) => compareSearchCycleLabels(left, right))
    .map(([label, total]) => ({
      label,
      total,
      buckets: Array.from(bucketMap.values())
        .filter((bucket) => bucket.searchCycleLabel === label)
        .sort((left, right) => {
          if (left.pool !== right.pool) {
            return left.pool.localeCompare(right.pool);
          }

          return left.stage.localeCompare(right.stage);
        })
    }));

  return {
    cycles,
    sunkenActiveCount,
    sunkenThresholdDate: threshold.toISOString(),
    sunkenMonths
  };
}
