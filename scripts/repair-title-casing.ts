import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { closeDb } from "../lib/db/client";
import { getJobsByPool, updateJobRecord } from "../lib/db/repository";
import { extractJobOnServer } from "../lib/server/extraction-service";
import type { JobRecord } from "../lib/types";

/**
 * Restores the poster's casing on Active role titles that the old blanket
 * title-case pass flattened ("(GBS)" -> "(gbs)", "(MBA)" -> "(Mba)").
 *
 * Re-fetches each posting link and re-extracts the title with the current
 * extractor. A record is only updated when the fresh title matches the
 * stored one letter for letter apart from casing, so dead links, reposted
 * roles and hand-edited titles are left alone. Rejected records are skipped.
 *
 * Dry-run by default; --apply writes through updateJobRecord, which also
 * rebuilds search_text.
 */

type ScriptMode = "dry-run" | "apply";

type TitleUpdate = {
  record: JobRecord;
  after: string;
};

const CONCURRENCY = 4;

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
  return { mode: (argv.includes("--apply") ? "apply" : "dry-run") as ScriptMode };
}

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

function countUppercase(value: string) {
  return value.replace(/[^A-Z]/g, "").length;
}

export function planTitleCasing(stored: string, fresh: string) {
  const before = collapse(stored);
  const after = collapse(fresh);
  if (!after || before === after || before.toLowerCase() !== after.toLowerCase()) {
    return null;
  }

  // Only restore capitals the old pass dropped. A fresh title with fewer
  // capitals came from an all-caps page that is itself title-cased now
  // ("SAS Analyst" -> "Sas Analyst"), and template junk is left for a human.
  if (countUppercase(after) <= countUppercase(before) || after.includes("{{")) {
    return null;
  }

  // "Strategy and" -> "Strategy And" is the same all-caps-page artefact.
  const beforeWords = before.split(" ");
  const capitalisesMinorWord = after
    .split(" ")
    .some((word, index) => word !== beforeWords[index] && MINOR_WORDS.has(beforeWords[index] ?? ""));
  if (capitalisesMinorWord) {
    return null;
  }

  return after;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode } = parseArgs(process.argv.slice(2));
  const records = (await getJobsByPool("active")).filter((record) => record.link);

  const updates: TitleUpdate[] = [];
  let fetched = 0;
  let unchanged = 0;
  let mismatched = 0;
  let failed = 0;

  let next = 0;
  async function worker() {
    while (next < records.length) {
      const record = records[next++];
      try {
        const result = await extractJobOnServer(record.link);
        const fresh = result.fields.roleTitle ?? "";
        fetched += 1;
        const after = planTitleCasing(record.roleTitle, fresh);
        if (after) {
          updates.push({ record, after });
        } else if (fresh && collapse(fresh).toLowerCase() === collapse(record.roleTitle).toLowerCase()) {
          unchanged += 1;
        } else {
          mismatched += 1;
        }
      } catch {
        failed += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`Title casing repair (${mode.toUpperCase()})`);
  console.log(`Target: ${process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "local store"}`);
  console.log(`Active records with a link: ${records.length}`);
  console.log(
    `  fetched: ${fetched} | casing fix: ${updates.length} | already right: ${unchanged} | title differs or unavailable: ${mismatched} | errors: ${failed}`
  );
  for (const update of updates) {
    console.log(`  ${update.record.id} | ${update.record.searchCycleLabel}`);
    console.log(`    "${update.record.roleTitle}" -> "${update.after}"`);
  }

  if (mode === "dry-run") {
    console.log("No changes applied. Re-run with --apply to write these fixes.");
    await closeDb().catch(() => undefined);
    return;
  }

  for (const update of updates) {
    await updateJobRecord({ ...update.record, roleTitle: update.after });
  }

  console.log(`Applied ${updates.length} record update(s).`);
  await closeDb().catch(() => undefined);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exitCode = 1;
});
