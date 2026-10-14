import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import {
  archiveStaleActiveJobs,
  findStaleActiveJobs
} from "../lib/db/repository";
import { normalizeSearchCycleLabel } from "../lib/search-cycle";
import {
  STALE_ACTIVE_DAYS,
  getStaleActiveThreshold
} from "../lib/stale-archive";
import { formatDate } from "../lib/utils";

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

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode } = parseArgs(process.argv.slice(2));
  const now = new Date();
  const threshold = getStaleActiveThreshold(now);
  const stale = await findStaleActiveJobs(now);

  const byCycle = new Map<string, number>();
  for (const record of stale) {
    const label = normalizeSearchCycleLabel(record.searchCycleLabel, record.timestamp);
    byCycle.set(label, (byCycle.get(label) ?? 0) + 1);
  }

  console.log(`Stale Active archive (${mode.toUpperCase()})`);
  console.log(
    `Rule: pool=active, stage=no_response, saved before ${threshold.toISOString()} (> ${STALE_ACTIVE_DAYS} days ago)`
  );
  console.log(`Target: ${process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "local store"}`);
  console.log(`Records to archive: ${stale.length}`);
  for (const [label, count] of byCycle) {
    console.log(`  ${label}: ${count}`);
  }

  console.log("Sample (first 20):");
  for (const record of stale.slice(0, 20)) {
    console.log(
      `  ${record.id} | saved ${formatDate(record.timestamp)} | ${record.company} | ${record.roleTitle}`
    );
  }

  if (mode === "dry-run") {
    console.log("No changes applied. Re-run with --apply to archive these records.");
    await closeDb().catch(() => undefined);
    return;
  }

  const { archivedIds } = await archiveStaleActiveJobs(now);
  console.log(
    `Archived ${archivedIds.length} record(s) to Rejected with an "Auto-archived" note.`
  );
  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
