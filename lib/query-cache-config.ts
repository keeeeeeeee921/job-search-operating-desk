function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

export const QUERY_CACHE_TTL_MS = parsePositiveNumber(
  process.env.JOB_DESK_QUERY_CACHE_TTL_MS,
  15_000
);

export const QUERY_CACHE_MAX_ENTRIES = parsePositiveNumber(
  process.env.JOB_DESK_QUERY_CACHE_MAX_ENTRIES,
  300
);

export const QUERY_CACHE_BUCKET_LIMITS = {
  recent: parsePositiveNumber(
    process.env.JOB_DESK_QUERY_CACHE_RECENT_MAX_ENTRIES,
    40
  ),
  count: parsePositiveNumber(
    process.env.JOB_DESK_QUERY_CACHE_COUNT_MAX_ENTRIES,
    120
  ),
  page: parsePositiveNumber(
    process.env.JOB_DESK_QUERY_CACHE_PAGE_MAX_ENTRIES,
    300
  )
} as const;
