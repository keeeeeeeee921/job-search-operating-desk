import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";
import {
  buildHistoricalIdentityKey,
  buildHistoricalRecord,
  historicalImportSheets,
  isBlankHistoricalRow,
  isImportableHistoricalDraft,
  mapHistoricalRowToDraft,
  spreadHistoricalTimestamps,
  type HistoricalImportDraft,
  type HistoricalImportSheetName,
  type HistoricalImportStats,
  type HistoricalWorkbookInputRow
} from "../lib/historical-import";
import {
  getAllRecords,
  getDailyGoalsState,
  insertJobsWithoutGoalEffects
} from "../lib/db/repository";
import type { JobPool, JobRecord } from "../lib/types";

type ScriptMode = "dry-run" | "apply";

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
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  let filePath = "";
  let mode: ScriptMode = "dry-run";

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--file") {
      filePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--apply") {
      mode = "apply";
      continue;
    }

    if (value === "--dry-run") {
      mode = "dry-run";
    }
  }

  if (!filePath) {
    throw new Error(
      'Missing --file argument. Example: pnpm import:historical -- --file "/Users/keshi/Downloads/北美秋招.xlsx" --dry-run'
    );
  }

  return {
    filePath: path.resolve(process.cwd(), filePath),
    mode
  };
}

function createSheetStats(sheetName: HistoricalImportSheetName, pool: JobPool): HistoricalImportStats {
  return {
    sheetName,
    pool,
    totalRows: 0,
    skippedBlankRows: 0,
    skippedInvalidRows: 0,
    importableRows: 0,
    skippedDuplicates: 0,
    inserted: 0
  };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { filePath, mode } = parseArgs(process.argv.slice(2));
  const workbook = XLSX.readFile(filePath);

  const statsBySheet = new Map<HistoricalImportSheetName, HistoricalImportStats>();
  const drafts: HistoricalImportDraft[] = [];

  for (const sheet of historicalImportSheets) {
    const stats = createSheetStats(sheet.name, sheet.pool);
    statsBySheet.set(sheet.name, stats);

    const worksheet = workbook.Sheets[sheet.name];
    if (!worksheet) {
      throw new Error(`Missing expected sheet: ${sheet.name}`);
    }

    const rows = XLSX.utils.sheet_to_json<HistoricalWorkbookInputRow>(worksheet, {
      defval: ""
    });

    rows.forEach((row, index) => {
      stats.totalRows += 1;

      if (isBlankHistoricalRow(row)) {
        stats.skippedBlankRows += 1;
        return;
      }

      const draft = mapHistoricalRowToDraft({
        row,
        rowNumber: index + 2,
        sheetName: sheet.name,
        pool: sheet.pool
      });

      if (!isImportableHistoricalDraft(draft)) {
        stats.skippedInvalidRows += 1;
        return;
      }

      stats.importableRows += 1;
      drafts.push(draft);
    });
  }

  const timestamps = spreadHistoricalTimestamps({
    count: drafts.length,
    start: "2025-09-16",
    end: "2026-03-07"
  });

  const candidates = drafts.map((draft, index) => ({
    draft,
    record: buildHistoricalRecord(
      draft,
      timestamps[index] ?? timestamps[timestamps.length - 1] ?? new Date().toISOString()
    )
  }));

  const existing = await getAllRecords();
  const seenKeys = new Set(existing.map((record) => buildHistoricalIdentityKey(record)));
  const recordsToInsert: JobRecord[] = [];

  for (const candidate of candidates) {
    const record = candidate.record;
    const key = buildHistoricalIdentityKey(record);
    const stats = statsBySheet.get(candidate.draft.sheetName);

    if (seenKeys.has(key)) {
      if (stats) {
        stats.skippedDuplicates += 1;
      }
      continue;
    }

    seenKeys.add(key);
    recordsToInsert.push(record);
    if (stats) {
      stats.inserted += 1;
    }
  }

  const beforeGoals = await getDailyGoalsState();
  const finalSummary = Array.from(statsBySheet.values());

  console.log(`Historical import ${mode.toUpperCase()} for ${filePath}`);
  console.table(
    finalSummary.map((stats) => ({
      sheet: stats.sheetName,
      pool: stats.pool,
      totalRows: stats.totalRows,
      skippedBlankRows: stats.skippedBlankRows,
      skippedInvalidRows: stats.skippedInvalidRows,
      importableRows: stats.importableRows,
      skippedDuplicates: stats.skippedDuplicates,
      inserted: stats.inserted
    }))
  );
  console.log(
    `Prepared ${recordsToInsert.length} records (${recordsToInsert.filter((record) => record.pool === "active").length} Active, ${recordsToInsert.filter((record) => record.pool === "rejected").length} Rejected).`
  );

  if (mode === "dry-run") {
    return;
  }

  await insertJobsWithoutGoalEffects(recordsToInsert);
  const afterGoals = await getDailyGoalsState();

  if (JSON.stringify(beforeGoals) !== JSON.stringify(afterGoals)) {
    throw new Error("Daily goals changed during import. Import path must preserve today's counters.");
  }

  console.log("Historical import complete.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
