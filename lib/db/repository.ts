import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isPublicDemo } from "@/lib/demo";
import {
  archiveLocalJob,
  deleteLocalJob,
  ensureLocalStoreReady,
  getAllLocalRecords,
  getLocalDailyGoalsState,
  getLocalJobsByPool,
  insertLocalJob,
  insertLocalJobsWithoutGoalEffects,
  resetLocalStoreToSeedState,
  resetLocalStoreForTests,
  seedLocalStoreIfNeeded,
  updateLocalJobRecord,
  updateLocalComments,
  updateLocalDailyGoalState
} from "@/lib/db/local-store";
import { dailyGoalsTable, jobsTable } from "@/lib/db/schema";
import { findEmailMatches } from "@/lib/emailMatching";
import { getSeedStateForEnvironment } from "@/lib/seed";
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
  const seedState = getSeedStateForEnvironment();
  return {
    dateKey: getEasternDateKey(),
    applyCount: seedState.dailyGoals.goals.apply.count,
    applyTarget: seedState.dailyGoals.goals.apply.target,
    connectCount: seedState.dailyGoals.goals.connect.count,
    connectTarget: seedState.dailyGoals.goals.connect.target,
    followCount: seedState.dailyGoals.goals.follow.count,
    followTarget: seedState.dailyGoals.goals.follow.target
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
    applyCountedDateKey: row.applyCountedDateKey,
    sourceType: row.sourceType as JobRecord["sourceType"],
    sourceConfidence: row.sourceConfidence as JobRecord["sourceConfidence"],
    extractionStatus: row.extractionStatus as JobRecord["extractionStatus"]
  };
}

function withAutoApplyMarker(record: JobRecord) {
  if (record.pool !== "active") {
    return {
      ...record,
      applyCountedDateKey: record.applyCountedDateKey ?? null
    };
  }

  return {
    ...record,
    applyCountedDateKey: record.applyCountedDateKey ?? getEasternDateKey()
  };
}

function shouldReverseTodayApply(record: Pick<JobRecord, "pool" | "applyCountedDateKey">) {
  return (
    record.pool === "active" &&
    record.applyCountedDateKey === getEasternDateKey()
  );
}

async function persistDailyGoalsState(next: DailyGoalsState) {
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
}

async function adjustTodayApplyCount(delta: number) {
  const current = await getDailyGoalsState();
  const next = structuredClone(current);
  next.goals.apply.count = Math.max(0, next.goals.apply.count + delta);
  await persistDailyGoalsState(next);
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
  if (!isPublicDemo() && !shouldExplicitlySeedPostgres()) {
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

  const seedState = getSeedStateForEnvironment();
  await db.insert(jobsTable).values(
    [...seedState.activeJobs, ...seedState.rejectedJobs].map((record) => ({
      ...record,
      timestamp: new Date(record.timestamp)
    }))
  );

  await db.insert(dailyGoalsTable).values({
    dateKey: seedState.dailyGoals.dateKey,
    applyCount: seedState.dailyGoals.goals.apply.count,
    applyTarget: seedState.dailyGoals.goals.apply.target,
    connectCount: seedState.dailyGoals.goals.connect.count,
    connectTarget: seedState.dailyGoals.goals.connect.target,
    followCount: seedState.dailyGoals.goals.follow.count,
    followTarget: seedState.dailyGoals.goals.follow.target
  });
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

  const nextRecord = withAutoApplyMarker(record);

  if (shouldUseLocalFallback()) {
    await insertLocalJob(nextRecord);
    return;
  }

  await getDb().insert(jobsTable).values({
    ...nextRecord,
    timestamp: new Date(nextRecord.timestamp)
  });

  if (nextRecord.pool === "active" && nextRecord.applyCountedDateKey) {
    await adjustTodayApplyCount(1);
  }
}

export async function insertJobsWithoutGoalEffects(records: JobRecord[]) {
  await ensureDatabaseReady();

  if (records.length === 0) {
    return;
  }

  if (shouldUseLocalFallback()) {
    await insertLocalJobsWithoutGoalEffects(records);
    return;
  }

  await getDb().insert(jobsTable).values(
    records.map((record) => ({
      ...record,
      applyCountedDateKey: record.applyCountedDateKey ?? null,
      timestamp: new Date(record.timestamp)
    }))
  );
}

export async function updateJobRecord(record: JobRecord) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await updateLocalJobRecord(record);
    return;
  }

  await getDb()
    .update(jobsTable)
    .set({
      roleTitle: record.roleTitle,
      company: record.company,
      location: record.location,
      link: record.link,
      jobDescription: record.jobDescription,
      timestamp: new Date(record.timestamp),
      pool: record.pool,
      comments: record.comments,
      applyCountedDateKey: record.applyCountedDateKey,
      sourceType: record.sourceType,
      sourceConfidence: record.sourceConfidence,
      extractionStatus: record.extractionStatus
    })
    .where(eq(jobsTable.id, record.id));
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

  const existing = (
    await getDb().select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1)
  )[0];

  if (!existing) {
    return;
  }

  if (shouldReverseTodayApply(mapJobRow(existing))) {
    await adjustTodayApplyCount(-1);
  }

  await getDb().update(jobsTable).set({ pool: "rejected" }).where(eq(jobsTable.id, id));
}

export async function deleteJobRecord(id: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await deleteLocalJob(id);
    return;
  }

  const existing = (
    await getDb().select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1)
  )[0];

  if (!existing) {
    return;
  }

  if (shouldReverseTodayApply(mapJobRow(existing))) {
    await adjustTodayApplyCount(-1);
  }

  await getDb().delete(jobsTable).where(eq(jobsTable.id, id));
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

  await persistDailyGoalsState(next);

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

export async function resetCurrentEnvironmentToSeedState() {
  initialized = false;

  if (shouldUseLocalFallback()) {
    await resetLocalStoreToSeedState();
    initialized = true;
    return;
  }

  await ensurePostgresReady();
  const db = getDb();
  const seedState = getSeedStateForEnvironment();

  await db.delete(dailyGoalsTable);
  await db.delete(jobsTable);

  await db.insert(jobsTable).values(
    [...seedState.activeJobs, ...seedState.rejectedJobs].map((record) => ({
      ...record,
      applyCountedDateKey: record.applyCountedDateKey ?? null,
      timestamp: new Date(record.timestamp)
    }))
  );
  await db.insert(dailyGoalsTable).values({
    dateKey: seedState.dailyGoals.dateKey,
    applyCount: seedState.dailyGoals.goals.apply.count,
    applyTarget: seedState.dailyGoals.goals.apply.target,
    connectCount: seedState.dailyGoals.goals.connect.count,
    connectTarget: seedState.dailyGoals.goals.connect.target,
    followCount: seedState.dailyGoals.goals.follow.count,
    followTarget: seedState.dailyGoals.goals.follow.target
  });

  initialized = true;
}
