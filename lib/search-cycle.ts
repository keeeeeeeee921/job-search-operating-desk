import type { SearchCycle, SearchCycleInput } from "@/lib/types";

/**
 * Search cycles live in the search_cycles table (lib/db/schema.ts) and the
 * local store's searchCycles collection. This module holds the pure logic
 * that runs over that list: which cycle a record belongs to, which cycle is
 * the current working set, and how a cycle's period is displayed. Callers
 * load the list through getSearchCycles() in lib/db/repository.ts.
 *
 * Calendar dates (start_date, end_date) are YYYY-MM-DD keys in
 * SEARCH_CYCLE_TIME_ZONE; a record's timestamp is converted to that zone
 * before it is compared with them.
 */

export const SEARCH_CYCLE_TIME_ZONE = "America/Toronto";

export const SEARCH_01_LABEL = "Search 01";
export const SEARCH_02_LABEL = "Search 02";

/** Label a record gets when the cycle list is empty (never in practice). */
export const UNASSIGNED_SEARCH_CYCLE_LABEL = "Unassigned";

export const SEARCH_CYCLE_LABEL_MAX_LENGTH = 32;

/**
 * The rows migration 0009 inserts into search_cycles, repeated here so the
 * local store (and tests) boot with the same two cycles as Postgres.
 */
export const initialSearchCycles: readonly SearchCycleInput[] = [
  {
    label: SEARCH_01_LABEL,
    startDate: "2025-09-06",
    endDate: "2026-04-02",
    title: "First full-time search after graduation",
    goals: ["Find a job", "Keep some data analysis content in the role"],
    note:
      "This was my first full-time search after graduation, so the scope stayed broad. The goal was to land a solid role with at least some analytics work, without over-optimizing for a perfect match.",
    imageSrc: "/job-search-cycle-01.png"
  },
  {
    label: SEARCH_02_LABEL,
    startDate: "2026-04-03",
    endDate: null,
    title: "",
    goals: [],
    note: "",
    imageSrc: null
  }
];

/** The part of a cycle the date logic needs; SearchCycle satisfies it. */
export type SearchCycleBoundary = Pick<SearchCycle, "label" | "startDate">;

/**
 * Which search cycles a list should show. "current" is the default working
 * set on /active and the home page; "older" is everything before it; "all"
 * keeps the historical behaviour (Rejected, analytics, scripts).
 */
export type SearchCycleScope = "current" | "older" | "all";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isSearchCycleDateKey(value: string) {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getSearchCycleDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEARCH_CYCLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function toDate(timestamp: string | Date) {
  return typeof timestamp === "string" ? new Date(timestamp) : timestamp;
}

/** Oldest start first; equal start dates keep their input order. */
export function sortSearchCyclesByStart<T extends SearchCycleBoundary>(
  cycles: readonly T[]
): T[] {
  return cycles
    .map((cycle, index) => ({ cycle, index }))
    .sort(
      (left, right) =>
        left.cycle.startDate.localeCompare(right.cycle.startDate) ||
        left.index - right.index
    )
    .map((entry) => entry.cycle);
}

/** The cycle with the latest start date: the current working set. */
export function getCurrentSearchCycle<T extends SearchCycleBoundary>(
  cycles: readonly T[]
): T | null {
  const sorted = sortSearchCyclesByStart(cycles);
  return sorted[sorted.length - 1] ?? null;
}

export function getCurrentSearchCycleLabel(cycles: readonly SearchCycleBoundary[]) {
  return getCurrentSearchCycle(cycles)?.label ?? UNASSIGNED_SEARCH_CYCLE_LABEL;
}

/**
 * The cycle a timestamp falls in: the latest start date on or before the
 * timestamp's calendar date. Anything earlier than the earliest cycle is
 * counted in that earliest cycle.
 */
export function resolveSearchCycle<T extends SearchCycleBoundary>(
  timestamp: string | Date,
  cycles: readonly T[]
): T | null {
  const sorted = sortSearchCyclesByStart(cycles);
  if (sorted.length === 0) {
    return null;
  }

  const dateKey = getSearchCycleDateKey(toDate(timestamp));
  let match = sorted[0];
  for (const cycle of sorted) {
    if (cycle.startDate <= dateKey) {
      match = cycle;
    } else {
      break;
    }
  }

  return match;
}

export function resolveSearchCycleLabel(
  timestamp: string | Date,
  cycles: readonly SearchCycleBoundary[]
) {
  return resolveSearchCycle(timestamp, cycles)?.label ?? UNASSIGNED_SEARCH_CYCLE_LABEL;
}

export function normalizeSearchCycleLabel(
  label: string | null | undefined,
  timestamp: string | Date,
  cycles: readonly SearchCycleBoundary[]
) {
  const trimmed = label?.trim();
  return trimmed ? trimmed : resolveSearchCycleLabel(timestamp, cycles);
}

export function isCurrentSearchCycleRecord(
  record: { searchCycleLabel: string | null; timestamp: string | Date },
  cycles: readonly SearchCycleBoundary[]
) {
  return (
    normalizeSearchCycleLabel(record.searchCycleLabel, record.timestamp, cycles) ===
    getCurrentSearchCycleLabel(cycles)
  );
}

export function matchesSearchCycleScope(
  record: { searchCycleLabel: string | null; timestamp: string | Date },
  scope: SearchCycleScope,
  cycles: readonly SearchCycleBoundary[]
) {
  if (scope === "all") {
    return true;
  }

  const isCurrent = isCurrentSearchCycleRecord(record, cycles);
  return scope === "current" ? isCurrent : !isCurrent;
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const wallClockAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second")
  );
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return wallClockAsUtc - wholeSeconds;
}

/**
 * Midnight at the start of a calendar day in SEARCH_CYCLE_TIME_ZONE as a UTC
 * instant, e.g. "2026-04-03" → 2026-04-03T04:00:00.000Z (EDT). Used by the
 * Postgres scope filter for rows whose search_cycle_label is still null.
 */
export function getSearchCycleStartInstant(
  dateKey: string,
  timeZone = SEARCH_CYCLE_TIME_ZONE
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day);
  const firstGuess = wallClock - zoneOffsetMs(new Date(wallClock), timeZone);
  // The first guess can sit on the wrong side of a DST switch; re-read the
  // offset at the guessed instant and correct once.
  const corrected = wallClock - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** "2025-09-06" → "Sep 6, 2025", independent of the server's time zone. */
export function formatSearchCycleDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "Sep 6, 2025 to Apr 2, 2026", or "Since Apr 3, 2026" while a cycle is open. */
export function formatSearchCyclePeriod(
  cycle: Pick<SearchCycle, "startDate" | "endDate">
) {
  const start = formatSearchCycleDateKey(cycle.startDate);
  return cycle.endDate
    ? `${start} to ${formatSearchCycleDateKey(cycle.endDate)}`
    : `Since ${start}`;
}

/** The calendar day before a date key, for closing the previous cycle. */
export function previousSearchCycleDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}
