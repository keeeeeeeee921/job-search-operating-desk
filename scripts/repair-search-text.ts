import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db/client";

type ScriptMode = "dry-run" | "apply";

type ScriptOptions = {
  from: string;
  to: string;
  mode: ScriptMode;
  onlyEmpty: boolean;
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

function toIsoDate(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

function parseArgs(argv: string[]): ScriptOptions {
  let from = "2026-03-08";
  let to = "2026-03-10";
  let mode: ScriptMode = "dry-run";
  let onlyEmpty = true;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--from") {
      from = toIsoDate(argv[index + 1], from);
      index += 1;
      continue;
    }

    if (value === "--to") {
      to = toIsoDate(argv[index + 1], to);
      index += 1;
      continue;
    }

    if (value === "--apply") {
      mode = "apply";
      continue;
    }

    if (value === "--dry-run") {
      mode = "dry-run";
      continue;
    }

    if (value === "--all") {
      onlyEmpty = false;
    }
  }

  if (from > to) {
    return { from: to, to: from, mode, onlyEmpty };
  }

  return { from, to, mode, onlyEmpty };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const options = parseArgs(process.argv.slice(2));
  const db = getDb();

  const rangeStats = await db.execute(sql`
    select
      count(*)::int as total,
      sum(case when coalesce(search_text, '') = '' then 1 else 0 end)::int as empty_count
    from jobs
    where (timestamp at time zone 'America/New_York')::date between ${options.from}::date and ${options.to}::date
  `);

  const perDay = await db.execute(sql`
    select
      to_char((timestamp at time zone 'America/New_York')::date, 'YYYY-MM-DD') as day,
      count(*)::int as total,
      sum(case when coalesce(search_text, '') = '' then 1 else 0 end)::int as empty_count
    from jobs
    where (timestamp at time zone 'America/New_York')::date between ${options.from}::date and ${options.to}::date
    group by 1
    order by 1
  `);

  const outsideRangeEmpty = await db.execute(sql`
    select count(*)::int as empty_count
    from jobs
    where coalesce(search_text, '') = ''
      and (timestamp at time zone 'America/New_York')::date not between ${options.from}::date and ${options.to}::date
  `);

  const emptySamples = await db.execute(sql`
    select id, role_title, company, location
    from jobs
    where (timestamp at time zone 'America/New_York')::date between ${options.from}::date and ${options.to}::date
      and coalesce(search_text, '') = ''
    order by timestamp desc
    limit 10
  `);

  console.log(`Search text repair (${options.mode.toUpperCase()})`);
  console.log(`Range: ${options.from} ~ ${options.to} (America/New_York)`);
  console.log(`In range: total=${rangeStats[0]?.total ?? 0}, empty=${rangeStats[0]?.empty_count ?? 0}`);
  console.log(
    `Outside range empty (report only): ${outsideRangeEmpty[0]?.empty_count ?? 0}`
  );
  console.log("Per-day:");
  for (const row of perDay) {
    console.log(
      `  ${row.day}: total=${row.total ?? 0}, empty=${row.empty_count ?? 0}`
    );
  }
  console.log("Sample empty rows:");
  for (const row of emptySamples) {
    console.log(
      `  ${row.id} | ${row.company} | ${row.role_title} | ${row.location}`
    );
  }

  if (options.mode === "dry-run") {
    console.log("No changes applied.");
    await closeDb();
    return;
  }

  const result = options.onlyEmpty
    ? await db.execute(sql`
        update jobs
        set search_text = lower(
          trim(
            regexp_replace(
              concat_ws(' ', company, role_title, location),
              '\s+',
              ' ',
              'g'
            )
          )
        )
        where (timestamp at time zone 'America/New_York')::date between ${options.from}::date and ${options.to}::date
          and coalesce(search_text, '') = ''
      `)
    : await db.execute(sql`
        update jobs
        set search_text = lower(
          trim(
            regexp_replace(
              concat_ws(' ', company, role_title, location),
              '\s+',
              ' ',
              'g'
            )
          )
        )
        where (timestamp at time zone 'America/New_York')::date between ${options.from}::date and ${options.to}::date
      `);

  const post = await db.execute(sql`
    select count(*)::int as empty_count
    from jobs
    where (timestamp at time zone 'America/New_York')::date between ${options.from}::date and ${options.to}::date
      and coalesce(search_text, '') = ''
  `);

  const updatedRows = (result as { count?: number }).count ?? 0;
  console.log(`Updated rows: ${updatedRows}`);
  console.log(`Remaining empty in range: ${post[0]?.empty_count ?? 0}`);
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await closeDb();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});

