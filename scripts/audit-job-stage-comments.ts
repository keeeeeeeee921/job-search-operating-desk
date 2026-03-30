import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import { formatJobStageLabel, inferStageFromComments } from "../lib/job-stage";
import { getAllRecords } from "../lib/db/repository";
import { truncate } from "../lib/utils";
import type { JobRecord, JobStage } from "../lib/types";

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

function incrementCounter(bucket: Map<JobStage, number>, stage: JobStage) {
  bucket.set(stage, (bucket.get(stage) ?? 0) + 1);
}

function formatAuditRow(record: JobRecord, inferredStage: JobStage) {
  return [
    record.id,
    record.pool,
    record.company,
    record.roleTitle,
    formatJobStageLabel(record.stage),
    formatJobStageLabel(inferredStage),
    truncate(record.comments.replace(/\s+/g, " ").trim(), 220)
  ].join(" | ");
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const records = await getAllRecords();
  const commentRecords = records.filter((record) => record.comments.trim().length > 0);
  const activeCount = commentRecords.filter((record) => record.pool === "active").length;
  const rejectedCount = commentRecords.filter((record) => record.pool === "rejected").length;
  const stageCounts = new Map<JobStage, number>();

  for (const record of commentRecords) {
    incrementCounter(stageCounts, record.stage);
  }

  const appliedWithComments = commentRecords.filter((record) => record.stage === "applied");
  const mismatches = commentRecords
    .map((record) => ({
      record,
      inferredStage: inferStageFromComments(record.comments)
    }))
    .filter(({ record, inferredStage }) => record.stage !== inferredStage);

  console.log("Job stage comments audit");
  console.log(`Total records: ${records.length}`);
  console.log(`Records with comments: ${commentRecords.length}`);
  console.log(`  Active: ${activeCount}`);
  console.log(`  Rejected: ${rejectedCount}`);
  console.log("Stored stage counts:");
  for (const [stage, count] of stageCounts) {
    console.log(`  ${formatJobStageLabel(stage)}: ${count}`);
  }

  console.log("");
  console.log(`Applied records with comments (${appliedWithComments.length})`);
  for (const record of appliedWithComments) {
    console.log(formatAuditRow(record, inferStageFromComments(record.comments)));
  }

  console.log("");
  console.log(`Stored vs inferred mismatches (${mismatches.length})`);
  for (const item of mismatches) {
    console.log(formatAuditRow(item.record, item.inferredStage));
  }

  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
