import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db/client";
import { jobsTable } from "../lib/db/schema";
import { getEasternDateKey } from "../lib/utils";

type AuditRow = {
  id: string;
  dateEt: string;
  timestamp: string;
  roleTitle: string;
  company: string;
  location: string;
  searchText: string;
};

type ParsedArgs = {
  days: number;
  limit: number;
  json: boolean;
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
  let limit = 100;
  let json = false;

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

    if (value === "--limit") {
      const parsed = Number(argv[index + 1] ?? "");
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.trunc(parsed);
      }
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
    }
  }

  return { days, limit, json };
}

function buildReasons(row: AuditRow) {
  const reasons: string[] = [];

  if (/^title\s*:/i.test(row.roleTitle)) {
    reasons.push("role_title_prefix");
  }

  if (/^(us|usa|united states)$/i.test(row.company.trim())) {
    reasons.push("company_country_only");
  }

  if (/logo/i.test(row.company)) {
    reasons.push("company_logo_noise");
  }

  if (
    /(display:\s*inline|#job-location|locate me|location\s*\(city\)|jobs\s*[>›]|workplace type|select\.\.\.)/i.test(
      row.location
    )
  ) {
    reasons.push("location_shell_noise");
  }

  if (row.location.length > 110) {
    reasons.push("location_too_long");
  }

  if (
    /(\$\s*\(\s*function|CandidateOpportunityDetail|ko\.applyBindings|create a job alert|autofill with mygreenhouse|submit application)/i.test(
      row.searchText
    )
  ) {
    reasons.push("shell_text_indexed");
  }

  if (!row.searchText.trim()) {
    reasons.push("search_text_empty");
  }

  return reasons;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { days, limit, json } = parseArgs(process.argv.slice(2));
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await getDb()
    .select({
      id: jobsTable.id,
      dateEt: sql<string>`to_char(${jobsTable.timestamp} at time zone 'America/New_York', 'YYYY-MM-DD')`,
      timestamp: sql<string>`to_char(${jobsTable.timestamp} at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI')`,
      roleTitle: jobsTable.roleTitle,
      company: jobsTable.company,
      location: jobsTable.location,
      searchText: jobsTable.searchText
    })
    .from(jobsTable)
    .where(and(eq(jobsTable.pool, "active"), gte(jobsTable.timestamp, threshold)))
    .orderBy(desc(jobsTable.timestamp))
    .limit(limit);

  const suspicious = rows
    .map((row) => ({
      ...row,
      reasons: buildReasons(row)
    }))
    .filter((row) => row.reasons.length > 0)
    .sort((left, right) => right.reasons.length - left.reasons.length);

  const trendMap = new Map<
    string,
    { scanned: number; suspicious: number; reasons: Record<string, number> }
  >();
  for (const row of rows) {
    const trend =
      trendMap.get(row.dateEt) ??
      ({
        scanned: 0,
        suspicious: 0,
        reasons: {}
      } satisfies { scanned: number; suspicious: number; reasons: Record<string, number> });

    trend.scanned += 1;
    const reasons = buildReasons(row);
    if (reasons.length > 0) {
      trend.suspicious += 1;
      for (const reason of reasons) {
        trend.reasons[reason] = (trend.reasons[reason] ?? 0) + 1;
      }
    }

    trendMap.set(row.dateEt, trend);
  }

  const trendRows = Array.from(trendMap.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([dateEt, trend]) => ({
      dateEt,
      scanned: trend.scanned,
      suspicious: trend.suspicious,
      topReasons: Object.entries(trend.reasons)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([reason, count]) => `${reason}:${count}`)
        .join(", ")
    }));

  if (json) {
    console.log(
      JSON.stringify(
        {
          days,
          scanned: rows.length,
          suspicious: suspicious.length,
          todayEt: getEasternDateKey(),
          trend: trendRows,
          items: suspicious.map((row) => ({
            id: row.id,
            timestamp: row.timestamp,
            roleTitle: row.roleTitle,
            company: row.company,
            location: row.location,
            reasons: row.reasons
          }))
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `Active record audit for the last ${days} day(s) (today ET ${getEasternDateKey()})`
    );
    console.log(`Scanned rows: ${rows.length}`);
    console.log(`Suspicious rows: ${suspicious.length}`);
    console.log("7-day trend:");
    console.table(trendRows);
    console.table(
      suspicious.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        roleTitle: row.roleTitle,
        company: row.company,
        location: row.location,
        reason: row.reasons.join(", ")
      }))
    );
  }

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
