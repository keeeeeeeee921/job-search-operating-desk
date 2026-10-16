import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import {
  getAllRecords,
  getSearchCycles,
  updateJobRecord
} from "../lib/db/repository";
import { jobStageLabels } from "../lib/job-stage";
import {
  countStages,
  parseInterviewedCompanyList,
  parseSetArgument,
  parseStageOverrides,
  planStageBackfill,
  type StageBackfillPlanRow,
  type StageOverrides
} from "../lib/stage-backfill";
import type { JobRecord } from "../lib/types";

/**
 * Backfills `stage` for records whose interview progress only lives in the
 * free-text comment (Search 01 predates the stage column).
 *
 * Scope: records still at no_response / rejected that either carry a human
 * comment (not just the "Auto-archived:" system note) or belong to a company
 * in scripts/backfill-stage-companies.json (records of the cycle named in
 * that file only). Keyword rules live in lib/stage-backfill.ts; the highest
 * matching stage wins, and listed companies with no keyword hit are
 * suggested Round 1.
 *
 * Manual corrections: scripts/backfill-stage-overrides.json maps an id (or
 * id prefix) to a stage, or to "skip"; `--set <id>=<stage>` does the same
 * from the command line and wins over the file. Overrides may target any
 * record, not just the automatic scope.
 *
 * Dry-run by default. --apply writes stage through updateJobRecord: Active
 * records change stage only; Rejected records change stage but keep
 * pool=rejected, matching stageAfterArchive() — a rejected record remembers
 * the furthest stage it reached, and the Search Log Sankey routes it
 * Applications → ... → that stage → Rejected.
 */

type ScriptMode = "dry-run" | "apply";

const OVERRIDES_FILE = path.join("scripts", "backfill-stage-overrides.json");
const COMPANIES_FILE = path.join("scripts", "backfill-stage-companies.json");

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  let mode: ScriptMode = "dry-run";
  let overridesPath = OVERRIDES_FILE;
  const setOverrides: StageOverrides = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") {
      mode = "apply";
    } else if (value === "--dry-run") {
      mode = "dry-run";
    } else if (value === "--set") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--set expects <id>=<stage>");
      }
      Object.assign(setOverrides, parseSetArgument(next));
      index += 1;
    } else if (value.startsWith("--set=")) {
      Object.assign(setOverrides, parseSetArgument(value.slice("--set=".length)));
    } else if (value === "--overrides") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--overrides expects a file path");
      }
      overridesPath = next;
      index += 1;
    } else if (value.startsWith("--overrides=")) {
      overridesPath = value.slice("--overrides=".length);
    } else {
      throw new Error(`Unknown argument "${value}"`);
    }
  }

  return { mode, overridesPath, setOverrides };
}

function loadCompanyList(filePath: string) {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
  return parseInterviewedCompanyList(raw, filePath);
}

function loadOverridesFile(filePath: string): StageOverrides {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    return {};
  }

  const raw = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
  return parseStageOverrides(raw, filePath);
}

// ---------------------------------------------------------------------------
// Table rendering (CJK-aware padding so mixed-language rows line up)
// ---------------------------------------------------------------------------

function charWidth(char: string) {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x1100 &&
    (code <= 0x115f ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6))
    ? 2
    : 1;
}

function displayWidth(value: string) {
  let width = 0;
  for (const char of value) {
    width += charWidth(char);
  }
  return width;
}

function truncate(value: string, maxChars: number) {
  const chars = Array.from(value);
  return chars.length > maxChars ? `${chars.slice(0, maxChars - 1).join("")}…` : value;
}

function pad(value: string, width: number) {
  const gap = width - displayWidth(value);
  return gap > 0 ? value + " ".repeat(gap) : value;
}

function flattenComment(comments: string, maxChars: number) {
  return truncate(comments.replace(/\s+/g, " ").trim(), maxChars);
}

type TableRow = {
  id: string;
  company: string;
  title: string;
  current: string;
  suggested: string;
  evidence: string;
  comment: string;
};

function toTableRow(row: StageBackfillPlanRow): TableRow {
  return {
    id: row.record.id.slice(0, 8),
    company: truncate(row.record.company, 24),
    title: truncate(row.record.roleTitle, 40),
    current: `${row.record.pool}/${row.currentStage}`,
    suggested: row.suggestedStage
      ? row.changed
        ? row.suggestedStage
        : `${row.suggestedStage} (no change)`
      : "(skip)",
    evidence: row.evidence.join(", "),
    comment: flattenComment(row.record.comments, 80)
  };
}

function printTable(rows: StageBackfillPlanRow[]) {
  const header: TableRow = {
    id: "id",
    company: "company",
    title: "role title",
    current: "pool/stage",
    suggested: "suggested",
    evidence: "evidence",
    comment: "comment"
  };
  const tableRows = rows.map(toTableRow);
  const columns = Object.keys(header) as Array<keyof TableRow>;
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(header[column].length, ...tableRows.map((row) => displayWidth(row[column])))
    ])
  ) as Record<keyof TableRow, number>;

  const line = (row: TableRow) =>
    columns.map((column) => pad(row[column], widths[column])).join(" | ");

  console.log(line(header));
  console.log(columns.map((column) => "-".repeat(widths[column])).join("-+-"));
  for (const row of tableRows) {
    console.log(line(row));
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode, overridesPath, setOverrides } = parseArgs(process.argv.slice(2));

  const fileOverrides = loadOverridesFile(overridesPath);
  const overrides: StageOverrides = { ...fileOverrides, ...setOverrides };

  const companyList = loadCompanyList(COMPANIES_FILE);
  const records = await getAllRecords();
  const cycles = await getSearchCycles();
  const plan = planStageBackfill(records, overrides, companyList, cycles);
  const changes = plan.rows.filter((row) => row.changed);

  console.log(`Stage backfill from comments (${mode.toUpperCase()})`);
  console.log(`Target: ${process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "local store"}`);
  console.log(
    `Overrides: ${Object.keys(fileOverrides).length} from ${overridesPath}${
      existsSync(path.resolve(process.cwd(), overridesPath)) ? "" : " (file not found)"
    }, ${Object.keys(setOverrides).length} from --set`
  );
  for (const key of plan.unmatchedOverrides) {
    console.warn(`  warning: override "${key}" matches no record`);
  }
  for (const entry of plan.ambiguousOverrides) {
    console.warn(
      `  warning: override "${entry.key}" matches ${entry.ids.length} records (${entry.ids.join(", ")}); use a longer prefix`
    );
  }
  console.log(
    `Company list: ${companyList.companies.length} companies for ${companyList.cycle} from ${COMPANIES_FILE}`
  );
  console.log(`Scanned records: ${records.length}`);
  console.log(`Rows: ${plan.rows.length} (${changes.length} would change)`);
  console.log("");

  if (plan.rows.length === 0) {
    console.log("Nothing matched.");
  } else {
    printTable(plan.rows);
  }

  console.log("");
  console.log("Suggested stage counts:");
  for (const { stage, count } of countStages(changes)) {
    console.log(`  ${jobStageLabels[stage].padEnd(14)} ${stage.padEnd(13)} ${count}`);
  }

  if (mode === "dry-run") {
    console.log("");
    console.log(
      "No changes applied. Fix wrong guesses in scripts/backfill-stage-overrides.json or with --set <id>=<stage>, then re-run with --apply."
    );
    await closeDb().catch(() => undefined);
    return;
  }

  let applied = 0;
  for (const row of changes) {
    if (!row.suggestedStage) {
      continue;
    }

    const next: JobRecord = { ...row.record, stage: row.suggestedStage };
    await updateJobRecord(next);
    applied += 1;
  }

  console.log("");
  console.log(`Applied ${applied} stage update(s). Rejected records kept pool=rejected.`);
  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
