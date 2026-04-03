import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import { getAllRecords, updateJobRecord } from "../lib/db/repository";
import { resolveSearchCycleLabel } from "../lib/search-cycle";

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
  const records = await getAllRecords();

  const resolvedCounts = new Map<string, number>();
  const updates = records
    .map((record) => {
      const resolvedLabel = resolveSearchCycleLabel(record.timestamp);
      resolvedCounts.set(
        resolvedLabel,
        (resolvedCounts.get(resolvedLabel) ?? 0) + 1
      );

      if ((record.searchCycleLabel ?? null) === resolvedLabel) {
        return null;
      }

      return {
        id: record.id,
        pool: record.pool,
        company: record.company,
        roleTitle: record.roleTitle,
        currentLabel: record.searchCycleLabel,
        resolvedLabel
      };
    })
    .filter((update): update is NonNullable<typeof update> => Boolean(update));

  console.log(`Search cycle backfill (${mode.toUpperCase()})`);
  console.log(`Scanned records: ${records.length}`);
  console.log(`Rows needing update: ${updates.length}`);
  console.log("Resolved cycle totals:");
  for (const [label, count] of resolvedCounts) {
    console.log(`  ${label}: ${count}`);
  }

  console.log("Sample updates:");
  for (const update of updates.slice(0, 20)) {
    console.log(
      `  ${update.id} | ${update.pool} | ${update.company} | ${update.roleTitle} | ${update.currentLabel ?? "null"} -> ${update.resolvedLabel}`
    );
  }

  if (mode === "dry-run") {
    console.log("No changes applied.");
    await closeDb().catch(() => undefined);
    return;
  }

  const recordMap = new Map(records.map((record) => [record.id, record]));

  for (const update of updates) {
    const record = recordMap.get(update.id);
    if (!record) {
      continue;
    }

    await updateJobRecord({
      ...record,
      searchCycleLabel: update.resolvedLabel
    });
  }

  console.log(`Applied ${updates.length} search cycle updates.`);
  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
