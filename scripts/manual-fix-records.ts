import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { getAllRecords, updateJobRecord } from "../lib/db/repository";
import type { JobRecord } from "../lib/types";
import { normalizeText } from "../lib/utils";

type ScriptMode = "dry-run" | "apply";

type RecordPatch = {
  roleTitle?: string;
  company?: string;
};

const TARGET_PATCHES = new Map<string, RecordPatch>([
  [
    "800ec2d0-2958-44e8-979e-c4d54859b94f",
    {
      company: "DoorDash"
    }
  ],
  [
    "6a23684d-a708-4061-ac72-03dcc088650a",
    {
      company: "PitchBook Data"
    }
  ],
  [
    "36110213-18b1-4115-be8e-d0b081b5c5a5",
    {
      company: "Impact.com"
    }
  ],
  [
    "1c0ff7e6-e26d-4635-b29d-66497c32474a",
    {
      company: "LetsGetChecked"
    }
  ],
  [
    "1d5c33ec-5b0e-47d7-ab7a-c16733d64d78",
    {
      company: "Trace3"
    }
  ],
  [
    "ad38756c-20f1-4453-bf17-466da234cb16",
    {
      company: "First Bank & Trust"
    }
  ],
  [
    "8b2479d5-14fd-49c6-bbb3-482fcd850af9",
    {
      company: "Nuvera"
    }
  ],
  [
    "142f6648-57db-427e-a04a-8c49b99fedc1",
    {
      company: "Extend"
    }
  ],
  [
    "c0443e42-528e-457a-a6ea-82a37da5ea83",
    {
      company: "Peregrine Technologies"
    }
  ]
]);

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
      continue;
    }

    if (value === "--dry-run") {
      mode = "dry-run";
    }
  }

  return { mode };
}

function buildSearchText(record: Pick<JobRecord, "company" | "roleTitle" | "location">) {
  return normalizeText(`${record.company} ${record.roleTitle} ${record.location}`);
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode } = parseArgs(process.argv.slice(2));
  const records = await getAllRecords();
  const recordMap = new Map(records.map((record) => [record.id, record]));

  const missingIds = [...TARGET_PATCHES.keys()].filter((id) => !recordMap.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Missing target records: ${missingIds.join(", ")}`);
  }

  const skippedRejected: string[] = [];

  const updates = [...TARGET_PATCHES.entries()].flatMap(([id, patch]) => {
    const record = recordMap.get(id)!;

    if (record.pool !== "active") {
      skippedRejected.push(id);
      return [];
    }

    const nextRecord: JobRecord = {
      ...record,
      roleTitle: patch.roleTitle ?? record.roleTitle,
      company: patch.company ?? record.company
    };

    if (
      nextRecord.roleTitle === record.roleTitle &&
      nextRecord.company === record.company
    ) {
      return [];
    }

    return [{
      id,
      before: record,
      after: nextRecord,
      searchText: buildSearchText(nextRecord)
    }];
  });

  console.log(
    `Manual fix ${mode.toUpperCase()}: ${updates.length} active updates, ${skippedRejected.length} SKIP_REJECTED`
  );
  if (skippedRejected.length > 0) {
    console.log("SKIP_REJECTED IDs:", skippedRejected.join(", "));
  }
  console.table(
    updates.map((update) => ({
      id: update.id,
      pool: update.before.pool,
      beforeRoleTitle: update.before.roleTitle,
      afterRoleTitle: update.after.roleTitle,
      beforeCompany: update.before.company,
      afterCompany: update.after.company,
      searchText: update.searchText
    }))
  );

  if (mode !== "apply") {
    console.log("Dry run only. No changes written.");
    return;
  }

  for (const update of updates) {
    await updateJobRecord(update.after);
  }

  console.log(`Applied ${updates.length} updates.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
