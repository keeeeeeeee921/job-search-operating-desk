import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { getAllRecords, updateJobRecord } from "../lib/db/repository";
import { extractJobOnServer } from "../lib/server/extraction-service";
import type { JobRecord } from "../lib/types";

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
  let date = "2026-03-08";
  let mode: ScriptMode = "dry-run";

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--date") {
      date = argv[index + 1] ?? date;
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

  return { date, mode };
}

function isMarch8Candidate(record: JobRecord, dateKey: string) {
  if (!record.link) {
    return false;
  }

  if (!record.timestamp.startsWith(dateKey)) {
    return false;
  }

  const badDescription =
    /&lt;|&gt;|&#\d+;|&#x[a-f0-9]+;|phapp|descriptionteaser/i.test(
      record.jobDescription
    );
  const badLocation =
    record.location.length > 100 ||
    /(join the team|jobs\s*[>›]|req id|position type|who are we hiring|madison square garden entertainment corp|analyst business intelligence)/i.test(
      record.location
    );
  const badCompany =
    record.company.length > 80 ||
    /lifeattiktok|msgentertainment|cincinnatichildrens/i.test(record.company);

  return badDescription || badLocation || badCompany;
}

function buildPatchedRecord(record: JobRecord, extraction: Awaited<ReturnType<typeof extractJobOnServer>>) {
  return {
    ...record,
    roleTitle: extraction.fields.roleTitle?.trim() || record.roleTitle,
    company: extraction.fields.company?.trim() || record.company,
    location: extraction.fields.location?.trim() || record.location,
    link: extraction.fields.link?.trim() || record.link,
    jobDescription: extraction.fields.jobDescription?.trim() || record.jobDescription,
    sourceType: extraction.sourceType,
    sourceConfidence: extraction.sourceConfidence,
    extractionStatus: extraction.extractionStatus
  } satisfies JobRecord;
}

function summarizeChanges(before: JobRecord, after: JobRecord) {
  const changed: string[] = [];
  for (const field of [
    "roleTitle",
    "company",
    "location",
    "jobDescription",
    "sourceType",
    "sourceConfidence",
    "extractionStatus"
  ] as const) {
    if (before[field] !== after[field]) {
      changed.push(field);
    }
  }
  return changed;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { date, mode } = parseArgs(process.argv.slice(2));
  const records = await getAllRecords();
  const candidates = records.filter((record) => isMarch8Candidate(record, date));

  console.log(
    `Repair ${mode.toUpperCase()} for ${date}: ${candidates.length} candidate records`
  );

  const updates: Array<{ id: string; changed: string[]; roleTitle: string; company: string }> =
    [];

  for (const record of candidates) {
    const extraction = await extractJobOnServer(record.link);
    const nextRecord = buildPatchedRecord(record, extraction);
    const changed = summarizeChanges(record, nextRecord);

    if (changed.length === 0) {
      continue;
    }

    updates.push({
      id: record.id,
      changed,
      roleTitle: nextRecord.roleTitle,
      company: nextRecord.company
    });

    if (mode === "apply") {
      await updateJobRecord(nextRecord);
    }
  }

  console.table(
    updates.map((update) => ({
      id: update.id,
      changed: update.changed.join(", "),
      roleTitle: update.roleTitle,
      company: update.company
    }))
  );

  console.log(`${mode === "apply" ? "Applied" : "Prepared"} ${updates.length} updates.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
