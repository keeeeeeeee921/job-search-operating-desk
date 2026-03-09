import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isPublicDemo } from "@/lib/demo";
import {
  archiveLocalJob,
  deleteLocalJob,
  ensureLocalStoreReady,
  getAllLocalRecords,
  getLocalActiveJobById,
  getLocalActiveJobCount,
  getLocalDailyGoalsState,
  getLocalJobsByPool,
  getLocalJobsPage,
  getLocalRecentActiveJobs,
  insertLocalJob,
  insertLocalJobsWithoutGoalEffects,
  resetLocalStoreToSeedState,
  resetLocalStoreForTests,
  searchLocalActiveJobsPage,
  seedLocalStoreIfNeeded,
  updateLocalJobRecord,
  updateLocalComments,
  updateLocalDailyGoalState
} from "@/lib/db/local-store";
import {
  buildPaginatedJobListResult,
  JOB_DESCRIPTION_PREVIEW_LENGTH,
  normalizePageNumber
} from "@/lib/job-list";
import { dailyGoalsTable, jobsTable } from "@/lib/db/schema";
import { findEmailMatches } from "@/lib/emailMatching";
import { getSeedStateForEnvironment } from "@/lib/seed";
import type {
  DailyGoalsState,
  GoalKey,
  JobListItem,
  JobPool,
  JobRecord,
  PaginatedJobListResult
} from "@/lib/types";
import { getEasternDateKey, normalizeText } from "@/lib/utils";

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
    applyAdjustment: seedState.dailyGoals.goals.apply.count,
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

function getJobListPreviewSelection() {
  return {
    id: jobsTable.id,
    roleTitle: jobsTable.roleTitle,
    company: jobsTable.company,
    location: jobsTable.location,
    link: jobsTable.link,
    timestamp: jobsTable.timestamp,
    sourceType: jobsTable.sourceType,
    sourceConfidence: jobsTable.sourceConfidence,
    extractionStatus: jobsTable.extractionStatus,
    jobDescriptionPreview: sql<string>`substring(${jobsTable.jobDescription} from 1 for ${JOB_DESCRIPTION_PREVIEW_LENGTH})`
  };
}

function mapJobListRow(row: {
  id: string;
  roleTitle: string;
  company: string;
  location: string;
  link: string;
  timestamp: Date;
  sourceType: string;
  sourceConfidence: string;
  extractionStatus: string;
  jobDescriptionPreview: string;
}): JobListItem {
  return {
    id: row.id,
    roleTitle: row.roleTitle,
    company: row.company,
    location: row.location,
    link: row.link,
    timestamp: row.timestamp.toISOString(),
    sourceType: row.sourceType as JobRecord["sourceType"],
    sourceConfidence: row.sourceConfidence as JobRecord["sourceConfidence"],
    extractionStatus: row.extractionStatus as JobRecord["extractionStatus"],
    jobDescriptionPreview: row.jobDescriptionPreview
  };
}

function buildActiveSearchCondition(query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return undefined;
  }

  return sql<boolean>`lower(concat_ws(' ', ${jobsTable.company}, ${jobsTable.roleTitle}, ${jobsTable.location})) like ${`%${normalizedQuery}%`}`;
}

function computeDisplayedApplyCount(autoApplyCount: number, applyAdjustment: number) {
  return Math.max(0, autoApplyCount + applyAdjustment);
}

async function countAutoAppliedActiveRecordsForDate(dateKey: string) {
  const [{ value }] = await getDb()
    .select({
      value: count()
    })
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.pool, "active"),
        eq(jobsTable.applyCountedDateKey, dateKey)
      )
    );

  return value;
}

async function persistDailyGoalsRow(row: typeof dailyGoalsTable.$inferSelect) {
  await getDb()
    .insert(dailyGoalsTable)
    .values({
      dateKey: row.dateKey,
      applyCount: row.applyCount,
      applyAdjustment: row.applyAdjustment,
      applyTarget: row.applyTarget,
      connectCount: row.connectCount,
      connectTarget: row.connectTarget,
      followCount: row.followCount,
      followTarget: row.followTarget
    })
    .onConflictDoUpdate({
      target: dailyGoalsTable.dateKey,
      set: {
        applyCount: row.applyCount,
        applyAdjustment: row.applyAdjustment,
        applyTarget: row.applyTarget,
        connectCount: row.connectCount,
        connectTarget: row.connectTarget,
        followCount: row.followCount,
        followTarget: row.followTarget
      }
    });
}

function mapGoalsRow(
  row: typeof dailyGoalsTable.$inferSelect,
  autoApplyCount: number
): DailyGoalsState {
  return {
    dateKey: row.dateKey,
    goals: {
      apply: {
        label: "Apply",
        count: computeDisplayedApplyCount(autoApplyCount, row.applyAdjustment),
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
    applyAdjustment: seedState.dailyGoals.goals.apply.count,
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
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalRecentActiveJobs(limit);
  }

  const rows = await getDb()
    .select(getJobListPreviewSelection())
    .from(jobsTable)
    .where(eq(jobsTable.pool, "active"))
    .orderBy(desc(jobsTable.timestamp))
    .limit(limit);

  return rows.map(mapJobListRow);
}

export async function getActiveJobById(id: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalActiveJobById(id);
  }

  const row = (
    await getDb()
      .select()
      .from(jobsTable)
      .where(and(eq(jobsTable.pool, "active"), eq(jobsTable.id, id)))
      .limit(1)
  )[0];

  return row ? mapJobRow(row) : null;
}

export async function getJobsPage(input: {
  pool: JobPool;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedJobListResult> {
  await ensureDatabaseReady();

  const pageSize = input.pageSize ?? 50;
  const page = normalizePageNumber(input.page);

  if (shouldUseLocalFallback()) {
    return getLocalJobsPage({
      pool: input.pool,
      page,
      pageSize
    });
  }

  const whereClause = eq(jobsTable.pool, input.pool);
  const [{ value: totalCount }] = await getDb()
    .select({ value: count() })
    .from(jobsTable)
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const rows = await getDb()
    .select(getJobListPreviewSelection())
    .from(jobsTable)
    .where(whereClause)
    .orderBy(desc(jobsTable.timestamp))
    .limit(pageSize)
    .offset(offset);

  return buildPaginatedJobListResult(
    rows.map(mapJobListRow),
    safePage,
    pageSize,
    totalCount
  );
}

export async function searchActiveJobsPage(input: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedJobListResult> {
  await ensureDatabaseReady();

  const pageSize = input.pageSize ?? 50;
  const page = normalizePageNumber(input.page);
  const searchCondition = buildActiveSearchCondition(input.query);

  if (shouldUseLocalFallback()) {
    return searchLocalActiveJobsPage({
      query: input.query,
      page,
      pageSize
    });
  }

  const whereClause = searchCondition
    ? and(eq(jobsTable.pool, "active"), searchCondition)
    : eq(jobsTable.pool, "active");
  const [{ value: totalCount }] = await getDb()
    .select({ value: count() })
    .from(jobsTable)
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const rows = await getDb()
    .select(getJobListPreviewSelection())
    .from(jobsTable)
    .where(whereClause)
    .orderBy(desc(jobsTable.timestamp))
    .limit(pageSize)
    .offset(offset);

  return buildPaginatedJobListResult(
    rows.map(mapJobListRow),
    safePage,
    pageSize,
    totalCount
  );
}

export async function getActiveJobCount() {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalActiveJobCount();
  }

  const [{ value }] = await getDb()
    .select({ value: count() })
    .from(jobsTable)
    .where(eq(jobsTable.pool, "active"));

  return value;
}

export async function hasActiveJobs() {
  return (await getActiveJobCount()) > 0;
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

  await getDb().delete(jobsTable).where(eq(jobsTable.id, id));
}

async function getTodayDailyGoalsRow() {
  const today = getEasternDateKey();
  const existing = (
    await getDb()
      .select()
      .from(dailyGoalsTable)
      .where(eq(dailyGoalsTable.dateKey, today))
      .limit(1)
  )[0];

  if (existing) {
    return existing;
  }

  const seeded = goalSeedForToday();
  await getDb().insert(dailyGoalsTable).values(seeded).onConflictDoNothing();

  return (
    (
      await getDb()
        .select()
        .from(dailyGoalsTable)
        .where(eq(dailyGoalsTable.dateKey, today))
        .limit(1)
    )[0] ?? seeded
  );
}

export async function getDailyGoalsState() {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalDailyGoalsState();
  }

  const row = await getTodayDailyGoalsRow();
  const autoApplyCount = await countAutoAppliedActiveRecordsForDate(row.dateKey);
  return mapGoalsRow(row, autoApplyCount);
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

  const row = await getTodayDailyGoalsRow();
  const autoApplyCount = await countAutoAppliedActiveRecordsForDate(row.dateKey);

  if (input.kind === "increment") {
    if (input.goal === "apply") {
      row.applyAdjustment += 1;
    } else if (input.goal === "connect") {
      row.connectCount += 1;
    } else {
      row.followCount += 1;
    }
  } else if (typeof input.value === "number" && input.value > 0) {
    if (input.goal === "apply") {
      row.applyTarget = input.value;
    } else if (input.goal === "connect") {
      row.connectTarget = input.value;
    } else {
      row.followTarget = input.value;
    }
  }

  row.applyCount = computeDisplayedApplyCount(autoApplyCount, row.applyAdjustment);
  await persistDailyGoalsRow(row);

  return mapGoalsRow(row, autoApplyCount);
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
    applyAdjustment: seedState.dailyGoals.goals.apply.count,
    applyTarget: seedState.dailyGoals.goals.apply.target,
    connectCount: seedState.dailyGoals.goals.connect.count,
    connectTarget: seedState.dailyGoals.goals.connect.target,
    followCount: seedState.dailyGoals.goals.follow.count,
    followTarget: seedState.dailyGoals.goals.follow.target
  });

  initialized = true;
}
