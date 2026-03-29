import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import { inferStageFromComments, formatJobStageLabel } from "../lib/job-stage";
import { getAllRecords, updateJobRecord } from "../lib/db/repository";
import type { JobStage } from "../lib/types";

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

function incrementCounter(bucket: Map<JobStage, number>, stage: JobStage) {
  bucket.set(stage, (bucket.get(stage) ?? 0) + 1);
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode } = parseArgs(process.argv.slice(2));
  const records = await getAllRecords();

  const inferredCounts = new Map<JobStage, number>();
  const updates = records
    .map((record) => {
      const inferredStage = inferStageFromComments(record.comments);
      incrementCounter(inferredCounts, inferredStage);

      if (record.stage === inferredStage) {
        return null;
      }

      return {
        id: record.id,
        pool: record.pool,
        roleTitle: record.roleTitle,
        company: record.company,
        currentStage: record.stage,
        inferredStage,
        comments: record.comments
      };
    })
    .filter((update): update is NonNullable<typeof update> => Boolean(update));

  console.log(`Job stage backfill (${mode.toUpperCase()})`);
  console.log(`Scanned records: ${records.length}`);
  console.log(`Rows needing update: ${updates.length}`);
  console.log("Inferred stage totals:");
  for (const [stage, count] of inferredCounts) {
    console.log(`  ${formatJobStageLabel(stage)}: ${count}`);
  }

  console.log("Sample updates:");
  for (const update of updates.slice(0, 20)) {
    console.log(
      `  ${update.id} | ${update.pool} | ${update.company} | ${update.roleTitle} | ${formatJobStageLabel(update.currentStage)} -> ${formatJobStageLabel(update.inferredStage)}`
    );
  }

  if (mode === "dry-run") {
    console.log("No changes applied.");
    await closeDb().catch(() => undefined);
    return;
  }

  for (const update of updates) {
    const record = records.find((row) => row.id === update.id);
    if (!record) {
      continue;
    }

    await updateJobRecord({
      ...record,
      stage: update.inferredStage
    });
  }

  console.log(`Applied ${updates.length} stage updates.`);
  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
