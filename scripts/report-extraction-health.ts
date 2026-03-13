import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db/client";

type ParsedArgs = {
  days: number;
  pool: "active" | "rejected" | "all";
  limit: number;
};

type HealthRow = {
  hostname: string;
  sourceType: string;
  extractionStatus: string;
  total: number;
  missingRoleTitle: number;
  missingCompany: number;
  missingLocation: number;
  missingDescription: number;
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
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  let days = 7;
  let pool: ParsedArgs["pool"] = "active";
  let limit = 20;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--days") {
      const parsed = Number(argv[index + 1] ?? "");
      if (Number.isFinite(parsed) && parsed > 0) {
        days = Math.trunc(parsed);
      }
      index += 1;
      continue;
    }

    if (value === "--pool") {
      const next = argv[index + 1] ?? "";
      if (next === "active" || next === "rejected" || next === "all") {
        pool = next;
      }
      index += 1;
      continue;
    }

    if (value === "--limit") {
      const parsed = Number(argv[index + 1] ?? "");
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.trunc(parsed);
      }
      index += 1;
    }
  }

  return { days, pool, limit };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { days, pool, limit } = parseArgs(process.argv.slice(2));
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = getDb();
  const poolFilter =
    pool === "all" ? sql`true` : sql`pool = ${pool}`;
  const rows = (await db.execute(sql`
    select
      coalesce(nullif(regexp_replace(link, '^https?://([^/]+).*$','\\1'), ''), '(no-link)') as "hostname",
      source_type as "sourceType",
      extraction_status as "extractionStatus",
      count(*)::int as "total",
      sum(case when coalesce(role_title, '') = '' then 1 else 0 end)::int as "missingRoleTitle",
      sum(case when coalesce(company, '') = '' then 1 else 0 end)::int as "missingCompany",
      sum(case when coalesce(location, '') = '' then 1 else 0 end)::int as "missingLocation",
      sum(case when coalesce(job_description, '') = '' then 1 else 0 end)::int as "missingDescription"
    from jobs
    where timestamp >= ${threshold}
      and ${poolFilter}
    group by 1, 2, 3
    order by "total" desc, "hostname" asc
    limit ${limit}
  `)) as HealthRow[];

  console.log(`Extraction health (${pool}, last ${days} day(s))`);
  console.table(rows);

  console.log("Top failing host/source families:");
  console.table(
    rows
      .filter((row) => row.extractionStatus !== "confirmed")
      .slice(0, 10)
      .map((row) => ({
        hostname: row.hostname,
        sourceType: row.sourceType,
        extractionStatus: row.extractionStatus,
        total: row.total,
        issueSummary: [
          row.missingRoleTitle ? `role:${row.missingRoleTitle}` : "",
          row.missingCompany ? `company:${row.missingCompany}` : "",
          row.missingLocation ? `location:${row.missingLocation}` : "",
          row.missingDescription ? `jd:${row.missingDescription}` : ""
        ]
          .filter(Boolean)
          .join(", ")
      }))
  );

  await closeDb();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await closeDb();
  } catch {
    // ignore close errors
  }
  process.exitCode = 1;
});
