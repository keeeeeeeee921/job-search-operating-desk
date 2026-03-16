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
  hostname: string;
  sourceType: string;
  roleTitle: string;
  company: string;
  location: string;
  jobDescription: string;
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

  const description = row.jobDescription.trim();
  if (!description) {
    reasons.push("job_description_missing");
  } else if (
    description.length < 120 ||
    /^(about the job|job details|description)\s*$/i.test(description)
  ) {
    reasons.push("job_description_thin");
  }

  return reasons;
}

function classifySourceFamily(row: Pick<AuditRow, "hostname" | "sourceType">) {
  const host = row.hostname.toLowerCase();
  const sourceType = row.sourceType.toLowerCase();

  if (sourceType === "linkedin" || host.includes("linkedin.com")) {
    return "linkedin";
  }

  if (sourceType === "greenhouse" || host.includes("greenhouse.io")) {
    return "greenhouse";
  }

  if (sourceType === "workday" || host.includes("workdayjobs.com")) {
    return "workday";
  }

  if (host.includes("dayforce")) {
    return "dayforce";
  }

  if (host.includes("ukg.net") || host.includes("rec.pro.ukg.net")) {
    return "ukg";
  }

  if (host.includes("phenompeople") || host.includes("jobs.")) {
    return "company-site";
  }

  return sourceType || "unknown";
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
      hostname: sql<string>`coalesce(nullif(regexp_replace(${jobsTable.link}, '^https?://([^/]+).*$','\\1'), ''), '(no-link)')`,
      sourceType: jobsTable.sourceType,
      roleTitle: jobsTable.roleTitle,
      company: jobsTable.company,
      location: jobsTable.location,
      jobDescription: jobsTable.jobDescription,
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

  const familyTrendMap = new Map<
    string,
    { family: string; scanned: number; suspicious: number }
  >();
  const hostnameTrendMap = new Map<
    string,
    { hostname: string; scanned: number; suspicious: number }
  >();

  for (const row of rows) {
    const reasons = buildReasons(row);
    const family = classifySourceFamily(row);
    const familyKey = `${row.dateEt}:${family}`;
    const familyTrend =
      familyTrendMap.get(familyKey) ??
      ({
        family,
        scanned: 0,
        suspicious: 0
      } satisfies { family: string; scanned: number; suspicious: number });
    familyTrend.scanned += 1;
    if (reasons.length > 0) {
      familyTrend.suspicious += 1;
    }
    familyTrendMap.set(familyKey, familyTrend);

    const hostKey = `${row.dateEt}:${row.hostname}`;
    const hostTrend =
      hostnameTrendMap.get(hostKey) ??
      ({
        hostname: row.hostname,
        scanned: 0,
        suspicious: 0
      } satisfies { hostname: string; scanned: number; suspicious: number });
    hostTrend.scanned += 1;
    if (reasons.length > 0) {
      hostTrend.suspicious += 1;
    }
    hostnameTrendMap.set(hostKey, hostTrend);
  }

  const familyTrendRows = Array.from(familyTrendMap.entries())
    .map(([key, value]) => {
      const [dateEt] = key.split(":");
      return {
        dateEt,
        sourceFamily: value.family,
        scanned: value.scanned,
        suspicious: value.suspicious
      };
    })
    .sort((left, right) => {
      if (right.dateEt !== left.dateEt) {
        return right.dateEt.localeCompare(left.dateEt);
      }

      return right.suspicious - left.suspicious;
    });

  const hostnameTrendRows = Array.from(hostnameTrendMap.entries())
    .map(([key, value]) => {
      const [dateEt] = key.split(":");
      return {
        dateEt,
        hostname: value.hostname,
        scanned: value.scanned,
        suspicious: value.suspicious
      };
    })
    .sort((left, right) => {
      if (right.dateEt !== left.dateEt) {
        return right.dateEt.localeCompare(left.dateEt);
      }

      return right.suspicious - left.suspicious;
    })
    .slice(0, 25);

  const patchTemplate = Object.fromEntries(
    suspicious.slice(0, 25).map((row) => [
      row.id,
      {
        roleTitle: row.roleTitle,
        company: row.company
      }
    ])
  );

  if (json) {
    console.log(
      JSON.stringify(
        {
          days,
          scanned: rows.length,
          suspicious: suspicious.length,
          todayEt: getEasternDateKey(),
          trend: trendRows,
          familyTrend: familyTrendRows,
          hostnameTrend: hostnameTrendRows,
          patchTemplate,
          items: suspicious.map((row) => ({
            id: row.id,
            timestamp: row.timestamp,
            hostname: row.hostname,
            sourceType: row.sourceType,
            sourceFamily: classifySourceFamily(row),
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
    console.log("Daily trend:");
    console.table(trendRows);
    console.log("Daily trend by source family:");
    console.table(familyTrendRows.slice(0, 30));
    console.log("Daily trend by hostname (top 25):");
    console.table(hostnameTrendRows);
    console.table(
      suspicious.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        hostname: row.hostname,
        sourceType: row.sourceType,
        sourceFamily: classifySourceFamily(row),
        roleTitle: row.roleTitle,
        company: row.company,
        location: row.location,
        reason: row.reasons.join(", ")
      }))
    );
    console.log("Patch template (copy into manual-fix mapping):");
    console.log(JSON.stringify(patchTemplate, null, 2));
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
