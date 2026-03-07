import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  archiveLocalJob,
  ensureLocalStoreReady,
  getAllLocalRecords,
  getLocalDailyGoalsState,
  getLocalJobsByPool,
  insertLocalJob,
  resetLocalStoreForTests,
  seedLocalStoreIfNeeded,
  updateLocalComments,
  updateLocalDailyGoalState
} from "@/lib/db/local-store";
import { dailyGoalsTable, jobsTable } from "@/lib/db/schema";
import { findEmailMatches } from "@/lib/emailMatching";
import {
  seedActiveJobs,
  seedDailyGoals,
  seedRejectedJobs
} from "@/lib/seed";
import type {
  DailyGoalsState,
  GoalKey,
  JobPool,
  JobRecord
} from "@/lib/types";
import { getEasternDateKey } from "@/lib/utils";

let initialized = false;

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

function shouldUseLocalFallback() {
  return !hasDatabaseUrl() && !process.env.VERCEL;
}

function shouldExplicitlySeedPostgres() {
  return process.env.JOB_DESK_ENABLE_SEED === "true";
}

function goalSeedForToday() {
  return {
    dateKey: getEasternDateKey(),
    applyCount: 0,
    applyTarget: seedDailyGoals.goals.apply.target,
    connectCount: 0,
    connectTarget: seedDailyGoals.goals.connect.target,
    followCount: 0,
    followTarget: seedDailyGoals.goals.follow.target
  };
}

function mapJobRow(row: typeof jobsTable.$inferSelect): JobRecord {
  return {
    id: row.id,
    roleTitle: row.roleTitle,
    company: row.company,
    location: row.location,
    link: row.link,
    jobDescription: row.jobDescription,
    timestamp: row.timestamp.toISOString(),
    pool: row.pool as JobPool,
    comments: row.comments,
    sourceType: row.sourceType as JobRecord["sourceType"],
    sourceConfidence: row.sourceConfidence as JobRecord["sourceConfidence"],
    extractionStatus: row.extractionStatus as JobRecord["extractionStatus"]
  };
}

function mapGoalsRow(row: typeof dailyGoalsTable.$inferSelect): DailyGoalsState {
  return {
    dateKey: row.dateKey,
    goals: {
      apply: {
        label: "Apply",
        count: row.applyCount,
        target: row.applyTarget
      },
      connect: {
        label: "Connect",
        count: row.connectCount,
        target: row.connectTarget
      },
      follow: {
        label: "Follow",
        count: row.followCount,
        target: row.followTarget
      }
    }
  };
}

async function assertPostgresSchemaReady() {
  const db = getDb();
  const healthResult = await db.execute(sql`
    select
      to_regclass('public.jobs')::text as "jobsTable",
      to_regclass('public.daily_goals')::text as "dailyGoalsTable",
      to_regclass('public.__drizzle_migrations')::text as "migrationsTable"
  `);
  const health = healthResult[0] as
    | {
        jobsTable: string | null;
        dailyGoalsTable: string | null;
        migrationsTable: string | null;
      }
    | undefined;

  if (!health?.jobsTable || !health?.dailyGoalsTable || !health?.migrationsTable) {
    throw new Error(
      "Postgres schema is missing required tables. Run `pnpm db:migrate` with DATABASE_URL_UNPOOLED before starting the app."
    );
  }
}

async function seedPostgresIfExplicitlyEnabled() {
  if (!shouldExplicitlySeedPostgres()) {
    return;
  }

  const db = getDb();
  const [{ value: total }] = await db
    .select({
      value: count()
    })
    .from(jobsTable);

  if (total > 0) {
    return;
  }

  await db.insert(jobsTable).values(
    [...seedActiveJobs, ...seedRejectedJobs].map((record) => ({
      ...record,
      timestamp: new Date(record.timestamp)
    }))
  );
}

async function ensurePostgresReady() {
  if (!hasDatabaseUrl()) {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is missing on Vercel. Configure DATABASE_URL and DATABASE_URL_UNPOOLED before deploying."
      );
    }

    throw new Error(
      "DATABASE_URL is not set. Use the local fallback only for offline development or tests."
    );
  }

  await assertPostgresSchemaReady();
  await seedPostgresIfExplicitlyEnabled();
}

export async function ensureDatabaseReady() {
  if (initialized) {
    return;
  }

  if (shouldUseLocalFallback()) {
    await ensureLocalStoreReady();
    await seedLocalStoreIfNeeded();
  } else {
    await ensurePostgresReady();
  }

  initialized = true;
}

export async function getJobsByPool(pool: JobPool) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalJobsByPool(pool);
  }

  const rows = await getDb()
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.pool, pool))
    .orderBy(desc(jobsTable.timestamp));

  return rows.map(mapJobRow);
}

export async function getRecentActiveJobs(limit = 4) {
  return (await getJobsByPool("active")).slice(0, limit);
}

export async function getActiveJobById(id: string) {
  const activeJobs = await getJobsByPool("active");
  return activeJobs.find((job) => job.id === id) ?? null;
}

export async function insertJob(record: JobRecord) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await insertLocalJob(record);
    return;
  }

  await getDb().insert(jobsTable).values({
    ...record,
    timestamp: new Date(record.timestamp)
  });

  if (record.pool === "active") {
    const current = await getDailyGoalsState();
    await getDb()
      .insert(dailyGoalsTable)
      .values({
        dateKey: current.dateKey,
        applyCount: current.goals.apply.count + 1,
        applyTarget: current.goals.apply.target,
        connectCount: current.goals.connect.count,
        connectTarget: current.goals.connect.target,
        followCount: current.goals.follow.count,
        followTarget: current.goals.follow.target
      })
      .onConflictDoUpdate({
        target: dailyGoalsTable.dateKey,
        set: {
          applyCount: current.goals.apply.count + 1,
          applyTarget: current.goals.apply.target,
          connectCount: current.goals.connect.count,
          connectTarget: current.goals.connect.target,
          followCount: current.goals.follow.count,
          followTarget: current.goals.follow.target
        }
      });
  }
}

export async function updateComments(id: string, comments: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await updateLocalComments(id, comments);
    return;
  }

  await getDb().update(jobsTable).set({ comments }).where(eq(jobsTable.id, id));
}

export async function archiveJobRecord(id: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await archiveLocalJob(id);
    return;
  }

  await getDb().update(jobsTable).set({ pool: "rejected" }).where(eq(jobsTable.id, id));
}

export async function getDailyGoalsState() {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalDailyGoalsState();
  }

  const today = getEasternDateKey();
  const existing = (
    await getDb()
      .select()
      .from(dailyGoalsTable)
      .where(eq(dailyGoalsTable.dateKey, today))
      .limit(1)
  )[0];

  if (existing) {
    return mapGoalsRow(existing);
  }

  const seeded = goalSeedForToday();
  await getDb().insert(dailyGoalsTable).values(seeded).onConflictDoNothing();
  return {
    dateKey: seeded.dateKey,
    goals: {
      apply: {
        label: "Apply",
        count: seeded.applyCount,
        target: seeded.applyTarget
      },
      connect: {
        label: "Connect",
        count: seeded.connectCount,
        target: seeded.connectTarget
      },
      follow: {
        label: "Follow",
        count: seeded.followCount,
        target: seeded.followTarget
      }
    }
  };
}

export async function updateDailyGoalState(input: {
  goal: GoalKey;
  kind: "increment" | "target";
  value?: number;
}) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return updateLocalDailyGoalState(input);
  }

  const current = await getDailyGoalsState();
  const next = structuredClone(current);

  if (input.kind === "increment") {
    next.goals[input.goal].count += 1;
  } else if (typeof input.value === "number" && input.value > 0) {
    next.goals[input.goal].target = input.value;
  }

  await getDb()
    .insert(dailyGoalsTable)
    .values({
      dateKey: next.dateKey,
      applyCount: next.goals.apply.count,
      applyTarget: next.goals.apply.target,
      connectCount: next.goals.connect.count,
      connectTarget: next.goals.connect.target,
      followCount: next.goals.follow.count,
      followTarget: next.goals.follow.target
    })
    .onConflictDoUpdate({
      target: dailyGoalsTable.dateKey,
      set: {
        applyCount: next.goals.apply.count,
        applyTarget: next.goals.apply.target,
        connectCount: next.goals.connect.count,
        connectTarget: next.goals.connect.target,
        followCount: next.goals.follow.count,
        followTarget: next.goals.follow.target
      }
    });

  return next;
}

export async function matchEmailAgainstActiveRecords(emailText: string) {
  const activeJobs = await getJobsByPool("active");
  return findEmailMatches(emailText, activeJobs);
}

export async function resetDatabaseForTests() {
  initialized = false;

  if (shouldUseLocalFallback()) {
    await resetLocalStoreForTests();
    return;
  }

  const db = getDb();
  await db.execute(sql`drop table if exists daily_goals`);
  await db.execute(sql`drop table if exists jobs`);
}

export async function getAllRecords() {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getAllLocalRecords();
  }

  const rows = await getDb().select().from(jobsTable).orderBy(desc(jobsTable.timestamp));
  return rows.map(mapJobRow);
}
