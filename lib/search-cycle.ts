const SEARCH_CYCLE_TIME_ZONE = "America/Toronto";

export const SEARCH_01_LABEL = "Search 01";
export const SEARCH_02_LABEL = "Search 02";
export const SEARCH_02_START_DATE_KEY = "2026-04-03";

export type SearchLogCycle = {
  label: string;
  period: string;
  title: string;
  goals: readonly string[];
  note: string;
  interviewedCompanies: readonly string[];
  imageSrc: string;
  imageAlt: string;
};

export function getSearchCycleDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEARCH_CYCLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function resolveSearchCycleLabel(timestamp: string | Date) {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return getSearchCycleDateKey(date) < SEARCH_02_START_DATE_KEY
    ? SEARCH_01_LABEL
    : SEARCH_02_LABEL;
}

export function normalizeSearchCycleLabel(
  label: string | null | undefined,
  timestamp: string | Date
) {
  const trimmed = label?.trim();
  return trimmed ? trimmed : resolveSearchCycleLabel(timestamp);
}

export const searchLogCycles: readonly SearchLogCycle[] = [
  {
    label: SEARCH_01_LABEL,
    period: "Sep 6, 2025 ~ April 2, 2026",
    title: "First full-time search after graduation",
    goals: ["Find a job", "Keep some data analysis content in the role"],
    note:
      "This was my first full-time search after graduation, so the scope stayed broad. The goal was to land a solid role with at least some analytics work, without over-optimizing for a perfect match.",
    interviewedCompanies: [
      "FedEx",
      "Corsair",
      "Valon",
      "Jerry.ai",
      "L'Oréal",
      "CarMax",
      "Axon",
      "Nomura",
      "ZURU Toys",
      "IBM Canada",
      "Tencent",
      "NYC Tourism + Conventions"
    ],
    imageSrc: "/job-search-cycle-01.png",
    imageAlt: "First job search cycle summary from September 6, 2025 through April 2, 2026"
  }
] as const;
