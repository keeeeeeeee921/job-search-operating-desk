import {
  SEARCH_CYCLE_LABEL_MAX_LENGTH,
  isSearchCycleDateKey,
  sortSearchCyclesByStart,
  type SearchCycleBoundary
} from "@/lib/search-cycle";
import type { SearchCycle, SearchCycleInput } from "@/lib/types";

/**
 * Hand-written validation for the two Search Log forms (edit a cycle's story,
 * start a new cycle). Field checks are pure; the cross-row checks take the
 * current cycle list so the server action can run them on fresh data.
 */

export const SEARCH_CYCLE_TITLE_MAX_LENGTH = 200;
export const SEARCH_CYCLE_GOAL_MAX_LENGTH = 200;
export const SEARCH_CYCLE_GOALS_MAX_COUNT = 20;
export const SEARCH_CYCLE_NOTE_MAX_LENGTH = 4000;
export const SEARCH_CYCLE_IMAGE_SRC_MAX_LENGTH = 500;

export type SearchCycleFormValues = Record<string, unknown>;

export type SearchCycleStoryValues = Omit<SearchCycleInput, "label">;

export type NewSearchCycleValues = Pick<SearchCycleInput, "label" | "startDate">;

export type FormParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function readString(values: SearchCycleFormValues, key: string) {
  const raw = values[key];
  if (raw === undefined || raw === null) {
    return "";
  }
  if (typeof raw !== "string") {
    return String(raw);
  }
  return raw;
}

/** Normalises line endings and strips control characters except newlines. */
function cleanText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

export function parseGoalsText(value: string) {
  return cleanText(value)
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);
}

export function goalsToText(goals: readonly string[]) {
  return goals.join("\n");
}

function parseOptionalDate(value: string, fieldName: string): FormParseResult<string | null> {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (!isSearchCycleDateKey(trimmed)) {
    return { ok: false, error: `${fieldName} must be a date in YYYY-MM-DD form.` };
  }
  return { ok: true, value: trimmed };
}

export function parseSearchCycleStoryForm(
  values: SearchCycleFormValues
): FormParseResult<SearchCycleStoryValues> {
  const title = cleanText(readString(values, "title")).replace(/\s+/g, " ");
  if (title.length > SEARCH_CYCLE_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Title must be at most ${SEARCH_CYCLE_TITLE_MAX_LENGTH} characters.`
    };
  }

  const goals = parseGoalsText(readString(values, "goals"));
  if (goals.length > SEARCH_CYCLE_GOALS_MAX_COUNT) {
    return {
      ok: false,
      error: `Keep it to ${SEARCH_CYCLE_GOALS_MAX_COUNT} goals or fewer.`
    };
  }
  const longGoal = goals.find((goal) => goal.length > SEARCH_CYCLE_GOAL_MAX_LENGTH);
  if (longGoal) {
    return {
      ok: false,
      error: `Each goal must be at most ${SEARCH_CYCLE_GOAL_MAX_LENGTH} characters.`
    };
  }

  const note = cleanText(readString(values, "note"));
  if (note.length > SEARCH_CYCLE_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `The note must be at most ${SEARCH_CYCLE_NOTE_MAX_LENGTH} characters.`
    };
  }

  const startDateRaw = readString(values, "startDate").trim();
  if (!startDateRaw) {
    return { ok: false, error: "Start date is required." };
  }
  if (!isSearchCycleDateKey(startDateRaw)) {
    return { ok: false, error: "Start date must be a date in YYYY-MM-DD form." };
  }

  const endDate = parseOptionalDate(readString(values, "endDate"), "End date");
  if (!endDate.ok) {
    return endDate;
  }
  if (endDate.value && endDate.value < startDateRaw) {
    return { ok: false, error: "End date must be on or after the start date." };
  }

  const imageSrcRaw = cleanText(readString(values, "imageSrc"));
  if (imageSrcRaw.length > SEARCH_CYCLE_IMAGE_SRC_MAX_LENGTH) {
    return {
      ok: false,
      error: `Image path must be at most ${SEARCH_CYCLE_IMAGE_SRC_MAX_LENGTH} characters.`
    };
  }
  if (
    imageSrcRaw &&
    !imageSrcRaw.startsWith("/") &&
    !/^https?:\/\//i.test(imageSrcRaw)
  ) {
    return {
      ok: false,
      error: "Image path must start with / (a file in public/) or with http(s)://."
    };
  }
  if (imageSrcRaw.startsWith("//")) {
    return { ok: false, error: "Image path must not start with //." };
  }

  return {
    ok: true,
    value: {
      title,
      goals,
      note,
      startDate: startDateRaw,
      endDate: endDate.value,
      imageSrc: imageSrcRaw || null
    }
  };
}

export function parseNewSearchCycleForm(
  values: SearchCycleFormValues
): FormParseResult<NewSearchCycleValues> {
  const label = cleanText(readString(values, "label")).replace(/\s+/g, " ");
  if (!label) {
    return { ok: false, error: "Label is required." };
  }
  if (label.length > SEARCH_CYCLE_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `Label must be at most ${SEARCH_CYCLE_LABEL_MAX_LENGTH} characters.`
    };
  }

  const startDate = readString(values, "startDate").trim();
  if (!startDate) {
    return { ok: false, error: "Start date is required." };
  }
  if (!isSearchCycleDateKey(startDate)) {
    return { ok: false, error: "Start date must be a date in YYYY-MM-DD form." };
  }

  return { ok: true, value: { label, startDate } };
}

function sameLabel(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * Cross-row checks for an edited story: the start date may move but must
 * not collide with another cycle's start date, because records are assigned
 * by "latest start date on or before".
 */
export function validateSearchCycleStoryAgainst(
  value: SearchCycleStoryValues,
  cycleId: number,
  cycles: readonly SearchCycle[]
): string | null {
  const clash = cycles.find(
    (cycle) => cycle.id !== cycleId && cycle.startDate === value.startDate
  );
  if (clash) {
    return `${clash.label} already starts on ${value.startDate}; two cycles cannot start on the same day.`;
  }

  return null;
}

/**
 * Cross-row checks for a new cycle. It becomes the current working set, so
 * it must start after every existing cycle and no later than today;
 * otherwise records saved today would still land in the previous cycle.
 */
export function validateNewSearchCycleAgainst(
  value: NewSearchCycleValues,
  cycles: readonly SearchCycleBoundary[],
  todayKey: string
): string | null {
  if (cycles.some((cycle) => sameLabel(cycle.label, value.label))) {
    return `A cycle labelled "${value.label}" already exists.`;
  }

  const latest = sortSearchCyclesByStart(cycles).at(-1);
  if (latest && value.startDate <= latest.startDate) {
    return `The new cycle must start after ${latest.label} (${latest.startDate}).`;
  }

  if (value.startDate > todayKey) {
    return `Start date cannot be in the future (today is ${todayKey}).`;
  }

  return null;
}

/** "Search 02" → "Search 03"; anything else → "Search <count + 1>". */
export function suggestNextSearchCycleLabel(cycles: readonly SearchCycleBoundary[]) {
  const latest = sortSearchCyclesByStart(cycles).at(-1);
  const match = latest ? /^(.*?)(\d+)$/.exec(latest.label) : null;
  if (match) {
    const [, prefix, digits] = match;
    const next = String(Number(digits) + 1).padStart(digits.length, "0");
    return `${prefix}${next}`;
  }

  return `Search ${String(cycles.length + 1).padStart(2, "0")}`;
}
