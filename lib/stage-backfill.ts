import { isJobStage, jobStageOrder } from "@/lib/job-stage";
import {
  SEARCH_01_LABEL,
  normalizeSearchCycleLabel,
  searchLogCycles
} from "@/lib/search-cycle";
import { AUTO_ARCHIVE_NOTE_PREFIX } from "@/lib/stale-archive";
import type { JobRecord, JobStage } from "@/lib/types";

/**
 * Pure logic behind scripts/backfill-stage-from-comments.ts.
 *
 * Search 01 records were saved before the stage column existed, so the only
 * trace of how far an application went is the free-text comment (mixed
 * Chinese / English: "prescreening", "11.13一面", "下一面和hm", "hr hm: ...").
 * This module turns those comments into a stage guess, with the matched
 * keywords kept as evidence so the dry-run table can be audited by eye.
 */

const AUTO_ARCHIVE_COMMENT_PREFIX = "Auto-archived:";

export const INTERVIEWED_COMPANIES_EVIDENCE = "interviewed-companies list";

type KeywordRule = {
  stage: JobStage;
  label: string;
  pattern: RegExp;
};

/**
 * Keyword → stage rules. Every rule is tested; the highest stage wins.
 *
 * Generic signals ("interview", "面试") only mean Round 1 when they are not
 * part of a screening phrase ("hr interview", "AI interview", "phone
 * interview", "first step in the interview process"), hence the lookarounds.
 * "一面" must not be the tail of "下一面" (= next round, Round 2), and
 * "offer" must not be "no offer" / "not offer" ("offer letter" still counts).
 */
export const stageKeywordRules: readonly KeywordRule[] = [
  // screening_oa
  { stage: "screening_oa", label: "prescreen", pattern: /\bpre[\s-]?screen/i },
  { stage: "screening_oa", label: "screening", pattern: /\bscreen/i },
  { stage: "screening_oa", label: "hr interview", pattern: /\bhr\s*(?:interview|面试|call|screen)/i },
  { stage: "screening_oa", label: "recruiter", pattern: /\brecruiter/i },
  { stage: "screening_oa", label: "AI interview", pattern: /\bai\s*(?:interview|面试)/i },
  { stage: "screening_oa", label: "phone interview", pattern: /\bphone\s*(?:interview|call)/i },
  { stage: "screening_oa", label: "OA", pattern: /\boa\b/i },
  { stage: "screening_oa", label: "assessment", pattern: /\bassessment/i },
  { stage: "screening_oa", label: "hackerrank", pattern: /\bhacker\s*rank/i },
  { stage: "screening_oa", label: "take-home", pattern: /\btake[\s-]?home/i },
  { stage: "screening_oa", label: "questionnaire", pattern: /\b(?:pre[\s-]?interview|questionnaire)\b/i },
  { stage: "screening_oa", label: "笔试", pattern: /笔试/ },
  { stage: "screening_oa", label: "过了一轮筛", pattern: /过了一轮筛/ },
  {
    stage: "screening_oa",
    label: "first step in the interview process",
    pattern: /first\s+step\s+in\s+the\s+interview\s+process/i
  },
  // round_1 (generic signals; see note above)
  { stage: "round_1", label: "一面", pattern: /(?<!下)一面/ },
  { stage: "round_1", label: "first round", pattern: /\b(?:first|1st)[\s-]*round\b/i },
  { stage: "round_1", label: "round 1", pattern: /\bround\s*(?:1|one)\b/i },
  {
    stage: "round_1",
    label: "interview",
    // "pre-interview questionnaire", "interview questionnaire", "offered an
    // interview" and "interview process" are screening-stage wording.
    pattern:
      /(?<!\b(?:hr|ai|phone|recruiter|screening)\s*)(?<!\bpre[\s-]?)\binterview(?!\s+(?:process|questionnaire|survey))/i
  },
  { stage: "round_1", label: "面试", pattern: /(?<!hr\s*)(?<!ai\s*)面试/i },
  // round_2
  { stage: "round_2", label: "二面", pattern: /二面/ },
  { stage: "round_2", label: "second round", pattern: /\b(?:second|2nd)[\s-]*round\b/i },
  { stage: "round_2", label: "round 2", pattern: /\bround\s*(?:2|two)\b/i },
  { stage: "round_2", label: "hm", pattern: /\bhm\b/i },
  { stage: "round_2", label: "hiring manager", pattern: /\bhiring\s*manager/i },
  { stage: "round_2", label: "下一面", pattern: /下一面/ },
  // round_3
  { stage: "round_3", label: "三面", pattern: /三面|终面/ },
  { stage: "round_3", label: "third round", pattern: /\b(?:third|3rd)[\s-]*round\b/i },
  { stage: "round_3", label: "round 3", pattern: /\bround\s*(?:3|three)\b/i },
  // bare "final" shows up in "final decision", "final answer"; require the round
  { stage: "round_3", label: "final round", pattern: /\bfinal\s*(?:round|interview|stage|面试)/i },
  { stage: "round_3", label: "onsite", pattern: /\bon[\s-]?site\b/i },
  { stage: "round_3", label: "case study", pattern: /\bcase[\s-]*study/i },
  // offer
  // A bare "offer" inside long notes (job descriptions, outreach emails) is
  // almost never an offer; require the word to carry a result.
  {
    stage: "offer",
    label: "offer",
    pattern:
      /(?<!\bno\s*)(?<!\bnot\s*)(?<!没有?\s*)(?<!无\s*)(?:\b(?:got|received|accepted|signed|verbal)\s+(?:an?\s+|the\s+)?offer\b|\boffer\s*(?:letter|received|accepted|signed|stage)\b|^\s*offer\b|(?:拿到|收到|接了)\s*offer)/im
  },
  { stage: "offer", label: "拿到", pattern: /拿到(?!\s*(?:面试|一面|二面|interview))/i }
];

const stageRank = new Map(jobStageOrder.map((stage, index) => [stage, index]));

export function compareStages(left: JobStage, right: JobStage) {
  return (stageRank.get(left) ?? -1) - (stageRank.get(right) ?? -1);
}

/** Drops the "Auto-archived: ..." system note lines before keyword matching. */
export function stripAutoArchiveNote(comments: string) {
  return comments
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith(AUTO_ARCHIVE_COMMENT_PREFIX) &&
        !trimmed.startsWith(AUTO_ARCHIVE_NOTE_PREFIX)
      );
    })
    .join("\n")
    .trim();
}

export function hasHumanComment(comments: string) {
  return stripAutoArchiveNote(comments).length > 0;
}

export type KeywordGuess = {
  stage: JobStage;
  evidence: string[];
};

/**
 * Returns the highest stage any keyword rule matches, plus the labels of
 * every rule that matched (highest stage first), or null when nothing hits.
 */
export function guessStageFromComments(comments: string): KeywordGuess | null {
  const text = stripAutoArchiveNote(comments);
  if (!text) {
    return null;
  }

  const hits = stageKeywordRules.filter((rule) => rule.pattern.test(text));
  if (hits.length === 0) {
    return null;
  }

  const best = hits.reduce((top, rule) =>
    compareStages(rule.stage, top.stage) > 0 ? rule : top
  );
  const evidence = Array.from(
    new Set(
      [...hits]
        .sort((left, right) => compareStages(right.stage, left.stage))
        .map((rule) => rule.label)
    )
  );

  return { stage: best.stage, evidence };
}

// ---------------------------------------------------------------------------
// Company list matching
// ---------------------------------------------------------------------------

export const interviewedCompaniesSearch01: readonly string[] =
  searchLogCycles.find((cycle) => cycle.label === SEARCH_01_LABEL)
    ?.interviewedCompanies ?? [];

function companyTokens(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9一-鿿]+/)
    .filter(Boolean);
}

function containsTokenSequence(haystack: string[], needle: string[]) {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }

  return false;
}

/**
 * The distinctive head of a list entry: its first token, or the first two
 * when the first is too short to stand alone ("NYC Tourism", "IBM Canada",
 * "L Oreal"). "Jerry.ai" → "jerry", "ZURU Toys" → "zuru".
 */
function companyHeadTokens(tokens: string[]) {
  const first = tokens[0];
  if (!first) {
    return [];
  }

  return first.length >= 4 ? [first] : tokens.slice(0, 2);
}

/**
 * Case- and accent-insensitive, token-based containment in both directions:
 * "Tencent" matches "Tencent America", "Jerry.ai" matches "Jerry",
 * "NYC Tourism + Conventions" matches "NYC Tourism". Token matching keeps
 * "Axon" from matching "Saxon Bank".
 */
export function matchesCompanyName(recordCompany: string, listedCompany: string) {
  const record = companyTokens(recordCompany);
  const listed = companyTokens(listedCompany);
  if (record.length === 0 || listed.length === 0) {
    return false;
  }

  const head = companyHeadTokens(listed);
  if (containsTokenSequence(record, listed) || containsTokenSequence(record, head)) {
    return true;
  }

  // The record name may be a shorter form of the listed one ("IBM" for
  // "IBM Canada"); require at least 3 characters so "A" never matches.
  const recordLength = record.join("").length;
  return recordLength >= 3 && containsTokenSequence(listed, record);
}

export function findInterviewedCompany(
  recordCompany: string,
  list: readonly string[] = interviewedCompaniesSearch01
) {
  return list.find((listed) => matchesCompanyName(recordCompany, listed)) ?? null;
}

// ---------------------------------------------------------------------------
// Overrides and planning
// ---------------------------------------------------------------------------

export const OVERRIDE_SKIP = "skip";

/** `id or id prefix` → stage, or "skip" to leave the record untouched. */
export type StageOverrides = Record<string, JobStage | typeof OVERRIDE_SKIP>;

export function parseStageOverrides(raw: unknown, source: string): StageOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${source}: expected a JSON object of { "<id or prefix>": "<stage>" }`);
  }

  const overrides: StageOverrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith("_")) {
      continue; // "_comment" style keys are documentation
    }

    if (value !== OVERRIDE_SKIP && !isJobStage(value)) {
      throw new Error(
        `${source}: "${key}" has invalid stage "${String(value)}" (expected one of ${jobStageOrder.join(", ")} or "${OVERRIDE_SKIP}")`
      );
    }

    overrides[key.trim()] = value as JobStage | typeof OVERRIDE_SKIP;
  }

  return overrides;
}

export function parseSetArgument(value: string): StageOverrides {
  const separator = value.indexOf("=");
  if (separator === -1) {
    throw new Error(`--set expects <id>=<stage>, got "${value}"`);
  }

  const key = value.slice(0, separator).trim();
  const stage = value.slice(separator + 1).trim();
  if (!key) {
    throw new Error(`--set expects <id>=<stage>, got "${value}"`);
  }

  return parseStageOverrides({ [key]: stage }, `--set ${value}`);
}

export type StageBackfillPlanRow = {
  record: JobRecord;
  currentStage: JobStage;
  suggestedStage: JobStage | null;
  evidence: string[];
  source: "keywords" | "company-list" | "override";
  /** false when the override says "skip" or matches the current stage. */
  changed: boolean;
};

export type StageBackfillPlan = {
  rows: StageBackfillPlanRow[];
  unmatchedOverrides: string[];
  ambiguousOverrides: Array<{ key: string; ids: string[] }>;
};

export function isBackfillCandidate(record: JobRecord) {
  return record.stage === "no_response" || record.stage === "rejected";
}

function isSearch01(record: JobRecord) {
  return (
    normalizeSearchCycleLabel(record.searchCycleLabel, record.timestamp) ===
    SEARCH_01_LABEL
  );
}

/**
 * Builds the dry-run table. Automatic guesses only touch records still at
 * no_response / rejected; an override may target any record and always wins.
 */
export function planStageBackfill(
  records: readonly JobRecord[],
  overrides: StageOverrides = {},
  interviewedCompanies: readonly string[] = interviewedCompaniesSearch01
): StageBackfillPlan {
  const overrideById = new Map<string, JobStage | typeof OVERRIDE_SKIP>();
  const unmatchedOverrides: string[] = [];
  const ambiguousOverrides: Array<{ key: string; ids: string[] }> = [];

  for (const [key, stage] of Object.entries(overrides)) {
    const matches = records.filter(
      (record) => record.id === key || record.id.startsWith(key)
    );
    if (matches.length === 0) {
      unmatchedOverrides.push(key);
    } else if (matches.length > 1) {
      ambiguousOverrides.push({ key, ids: matches.map((record) => record.id) });
    } else {
      overrideById.set(matches[0].id, stage);
    }
  }

  const rows: StageBackfillPlanRow[] = [];

  for (const record of records) {
    const override = overrideById.get(record.id);
    if (override !== undefined) {
      const suggestedStage = override === OVERRIDE_SKIP ? null : override;
      rows.push({
        record,
        currentStage: record.stage,
        suggestedStage,
        evidence: [override === OVERRIDE_SKIP ? "override: skip" : "override"],
        source: "override",
        changed: suggestedStage !== null && suggestedStage !== record.stage
      });
      continue;
    }

    if (!isBackfillCandidate(record)) {
      continue;
    }

    const keywordGuess = hasHumanComment(record.comments)
      ? guessStageFromComments(record.comments)
      : null;
    const listedCompany = isSearch01(record)
      ? findInterviewedCompany(record.company, interviewedCompanies)
      : null;

    if (keywordGuess) {
      rows.push({
        record,
        currentStage: record.stage,
        suggestedStage: keywordGuess.stage,
        evidence: listedCompany
          ? [...keywordGuess.evidence, INTERVIEWED_COMPANIES_EVIDENCE]
          : keywordGuess.evidence,
        source: "keywords",
        changed: keywordGuess.stage !== record.stage
      });
      continue;
    }

    // The company list says "I interviewed with this company once", not "every
    // application there got an interview", so it only backs up a record that
    // carries a human note (an empty or auto-archived record never interviewed).
    if (listedCompany && hasHumanComment(record.comments)) {
      rows.push({
        record,
        currentStage: record.stage,
        suggestedStage: "round_1",
        evidence: [INTERVIEWED_COMPANIES_EVIDENCE],
        source: "company-list",
        changed: record.stage !== "round_1"
      });
    }
  }

  return { rows, unmatchedOverrides, ambiguousOverrides };
}

export function countStages(rows: readonly StageBackfillPlanRow[]) {
  const counts = new Map<JobStage, number>();
  for (const row of rows) {
    if (!row.suggestedStage) {
      continue;
    }
    counts.set(row.suggestedStage, (counts.get(row.suggestedStage) ?? 0) + 1);
  }

  return jobStageOrder
    .filter((stage) => counts.has(stage))
    .map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
}
