import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import { getAllRecords, updateJobRecord } from "../lib/db/repository";
import { cleanJobIdentityFields } from "../lib/field-noise";
import type { JobRecord } from "../lib/types";

/**
 * Repairs scraped noise in stored company / role title / location values:
 * undecoded HTML entities ("Fp&amp;a"), posting metadata glued onto the
 * location ("San JoseEmployment Type:RegularJob Code:A107949"), aggregator
 * chrome ("Amazon.jobs · s") and flattened acronyms ("Data Analyst Ii",
 * "(usa) Senior, Data Analyst").
 *
 * Dry-run by default; --apply writes through updateJobRecord, which also
 * rebuilds search_text.
 */

type ScriptMode = "dry-run" | "apply";

type FieldChange = {
  field: "company" | "roleTitle" | "location";
  before: string;
  after: string;
};

type RecordUpdate = {
  record: JobRecord;
  changes: FieldChange[];
};

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

  for (const value of argv) {
    if (value === "--apply") {
      mode = "apply";
    } else if (value === "--dry-run") {
      mode = "dry-run";
    }
  }

  return { mode };
}

export function planRecordUpdate(record: JobRecord): RecordUpdate | null {
  const cleaned = cleanJobIdentityFields({
    company: record.company,
    roleTitle: record.roleTitle,
    location: record.location
  });

  const changes: FieldChange[] = [];
  for (const field of ["company", "roleTitle", "location"] as const) {
    const before = record[field];
    const after = cleaned[field];
    if (before === after) {
      continue;
    }

    // Never blank out a company or title; an emptied location is reported
    // explicitly below because only aggregator chrome produces it.
    if (!after && field !== "location") {
      continue;
    }

    changes.push({ field, before, after });
  }

  return changes.length > 0 ? { record, changes } : null;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode } = parseArgs(process.argv.slice(2));
  const records = await getAllRecords();

  const updates = records
    .map(planRecordUpdate)
    .filter((update): update is RecordUpdate => Boolean(update));

  const changesByField = { company: 0, roleTitle: 0, location: 0 };
  let emptiedLocations = 0;
  for (const update of updates) {
    for (const change of update.changes) {
      changesByField[change.field] += 1;
      if (change.field === "location" && !change.after) {
        emptiedLocations += 1;
      }
    }
  }

  console.log(`Extraction noise repair (${mode.toUpperCase()})`);
  console.log(`Target: ${process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "local store"}`);
  console.log(`Scanned records: ${records.length}`);
  console.log(`Records to update: ${updates.length}`);
  console.log(
    `  company: ${changesByField.company} | roleTitle: ${changesByField.roleTitle} | location: ${changesByField.location} (emptied: ${emptiedLocations})`
  );

  console.log("Sample (first 20):");
  for (const update of updates.slice(0, 20)) {
    console.log(`  ${update.record.id} | ${update.record.pool}`);
    for (const change of update.changes) {
      console.log(
        `    ${change.field}: "${change.before}" -> "${change.after || "(empty)"}"`
      );
    }
  }

  if (mode === "dry-run") {
    console.log("No changes applied. Re-run with --apply to write these fixes.");
    await closeDb().catch(() => undefined);
    return;
  }

  for (const update of updates) {
    const next: JobRecord = { ...update.record };
    for (const change of update.changes) {
      next[change.field] = change.after;
    }
    await updateJobRecord(next);
  }

  console.log(`Applied ${updates.length} record update(s).`);
  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
