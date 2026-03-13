import { and, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
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
  repairLocalTodayConnectGoalBaseline,
  resetLocalStoreToSeedState,
  resetLocalStoreForTests,
  searchLocalActiveJobsPage,
  seedLocalStoreIfNeeded,
  updateLocalJobRecord,
  updateLocalComments,
  updateLocalDailyGoalState
} from "@/lib/db/local-store";
import { DAILY_GOALS_DEFAULTS } from "@/lib/daily-goals-defaults";
import {
  buildPaginatedJobListResult,
  JOB_DESCRIPTION_PREVIEW_LENGTH,
  JOB_LIST_PAGE_SIZE,
  normalizePageNumber
} from "@/lib/job-list";
import { dailyGoalsTable, jobsTable } from "@/lib/db/schema";
import { findEmailMatches } from "@/lib/emailMatching";
import { getDefaultSeedState } from "@/lib/seed";
import type {
  DailyGoalsState,
  GoalKey,
  JobListItem,
  JobPool,
  JobRecord,
  PaginatedJobListResult
} from "@/lib/types";
import { getEasternDateKey, normalizeText, tokenize, uniqueValues } from "@/lib/utils";

let initialized = false;
const QUERY_CACHE_TTL_MS = Number(
  process.env.JOB_DESK_QUERY_CACHE_TTL_MS ?? "15000"
);

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const paginatedResultCache = new Map<
  string,
  CacheEntry<PaginatedJobListResult>
>();
const totalCountCache = new Map<string, CacheEntry<number>>();
const recentActiveCache = new Map<string, CacheEntry<JobListItem[]>>();

function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS
  });
}

async function getOrLoadCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  load: () => Promise<T>
) {
  const cached = readCache(cache, key);
  if (cached !== null) {
    return cached;
  }

  const value = await load();
  writeCache(cache, key, value);
  return value;
}

function clearQueryCaches() {
  paginatedResultCache.clear();
  totalCountCache.clear();
  recentActiveCache.clear();
}

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
    applyCount: DAILY_GOALS_DEFAULTS.apply.count,
    applyAdjustment: DAILY_GOALS_DEFAULTS.apply.count,
    applyTarget: DAILY_GOALS_DEFAULTS.apply.target,
    connectCount: DAILY_GOALS_DEFAULTS.connect.count,
    connectTarget: DAILY_GOALS_DEFAULTS.connect.target,
    followCount: DAILY_GOALS_DEFAULTS.follow.count,
    followTarget: DAILY_GOALS_DEFAULTS.follow.target
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

function buildSearchText(input: {
  company: string;
  roleTitle: string;
  location: string;
}) {
  return normalizeText(`${input.company} ${input.roleTitle} ${input.location}`);
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

  const escaped = normalizedQuery.replace(/[\\%_]/g, "\\$&");
  return sql<boolean>`${jobsTable.searchText} like ${`%${escaped}%`} escape '\\'`;
}

const tokenStopwords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "your",
  "this",
  "that",
  "are",
  "job",
  "jobs",
  "role",
  "position",
  "team",
  "remote"
]);

const emailHintStopwords = new Set([
  ...tokenStopwords,
  "dear",
  "hello",
  "thank",
  "thanks",
  "application",
  "applicants",
  "candidate",
  "candidates",
  "qualifications",
  "reviewed",
  "submission",
  "profile",
  "resume",
  "recruiting",
  "team",
  "regards",
  "sincerely",
  "opportunity",
  "opportunities",
  "employment"
]);

function escapeSqlLikeToken(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function sanitizeEmailPhrase(value: string) {
  const normalized = normalizeText(value)
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "")
    .replace(/\b(position|role|job)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length < 3 || normalized.length > 80) {
    return "";
  }

  if (emailHintStopwords.has(normalized)) {
    return "";
  }

  return normalized;
}

function extractEmailMatchingHints(emailText: string) {
  const companyPhrases: string[] = [];
  const rolePhrases: string[] = [];

  const roleAtCompanyPattern =
    /\binterest in (?:the )?(.{3,120}?) position at ([^\n.,;:]+)/gi;
  for (const match of emailText.matchAll(roleAtCompanyPattern)) {
    const role = sanitizeEmailPhrase(match[1] ?? "");
    const company = sanitizeEmailPhrase(match[2] ?? "");

    if (role) {
      rolePhrases.push(role);
    }

    if (company) {
      companyPhrases.push(company);
    }
  }

  const companyAtPattern = /\b(?:position|role|job)\s+at\s+([^\n.,;:]+)/gi;
  for (const match of emailText.matchAll(companyAtPattern)) {
    const company = sanitizeEmailPhrase(match[1] ?? "");
    if (company) {
      companyPhrases.push(company);
    }
  }

  const recruitingSignaturePattern =
    /\b([A-Za-z0-9&.'\- ]{2,80}?)\s+recruiting(?:\s+team)?\b/gi;
  for (const match of emailText.matchAll(recruitingSignaturePattern)) {
    const company = sanitizeEmailPhrase(match[1] ?? "");
    if (company) {
      companyPhrases.push(company);
    }
  }

  return {
    companyPhrases: uniqueValues(companyPhrases).slice(0, 5),
    rolePhrases: uniqueValues(rolePhrases).slice(0, 8)
  };
}

function buildTokenSearchConditions(tokens: string[]) {
  return tokens
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !tokenStopwords.has(token))
    .slice(0, 10)
    .map((token) => {
      const escaped = escapeSqlLikeToken(token);
      return sql<boolean>`${jobsTable.searchText} like ${`%${escaped}%`} escape '\\'`;
    });
}

function getDateThreshold(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function getCachedCount(
  key: string,
  load: () => Promise<number>
) {
  return getOrLoadCached(totalCountCache, key, load);
}

async function getRowsByIdsInOrder(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const rows = await getDb()
    .select()
    .from(jobsTable)
    .where(inArray(jobsTable.id, ids));
  const order = new Map(ids.map((id, index) => [id, index]));

  return rows.sort(
    (left, right) =>
      (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
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

  const seedState = getDefaultSeedState();
  await db.insert(jobsTable).values(
    [...seedState.activeJobs, ...seedState.rejectedJobs].map((record) => ({
      ...record,
      searchText: buildSearchText(record),
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

  return getOrLoadCached(recentActiveCache, `recent-active:${limit}`, async () => {
    const rows = await getDb()
      .select(getJobListPreviewSelection())
      .from(jobsTable)
      .where(eq(jobsTable.pool, "active"))
      .orderBy(desc(jobsTable.timestamp))
      .limit(limit);

    return rows.map(mapJobListRow);
  });
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

  const pageSize = input.pageSize ?? JOB_LIST_PAGE_SIZE;
  const page = normalizePageNumber(input.page);

  if (shouldUseLocalFallback()) {
    return getLocalJobsPage({
      pool: input.pool,
      page,
      pageSize
    });
  }

  const cacheKey = `jobs-page:${input.pool}:${page}:${pageSize}`;
  const cachedPage = readCache(paginatedResultCache, cacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const whereClause = eq(jobsTable.pool, input.pool);
  const totalCount = await getCachedCount(`jobs-count:${input.pool}`, async () => {
    const [{ value }] = await getDb()
      .select({ value: count() })
      .from(jobsTable)
      .where(whereClause);

    return value;
  });

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

  const pageResult = buildPaginatedJobListResult(
    rows.map(mapJobListRow),
    safePage,
    pageSize,
    totalCount
  );
  writeCache(paginatedResultCache, cacheKey, pageResult);
  return pageResult;
}

export async function searchActiveJobsPage(input: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedJobListResult> {
  await ensureDatabaseReady();

  const pageSize = input.pageSize ?? JOB_LIST_PAGE_SIZE;
  const page = normalizePageNumber(input.page);
  const searchCondition = buildActiveSearchCondition(input.query);

  if (shouldUseLocalFallback()) {
    return searchLocalActiveJobsPage({
      query: input.query,
      page,
      pageSize
    });
  }

  const normalizedQuery = normalizeText(input.query);
  const cacheKey = `search-page:${normalizedQuery}:${page}:${pageSize}`;
  const cachedPage = readCache(paginatedResultCache, cacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const whereClause = searchCondition
    ? and(eq(jobsTable.pool, "active"), searchCondition)
    : eq(jobsTable.pool, "active");
  const totalCount = await getCachedCount(
    `search-count:${normalizedQuery}`,
    async () => {
      const [{ value }] = await getDb()
        .select({ value: count() })
        .from(jobsTable)
        .where(whereClause);

      return value;
    }
  );

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

  const pageResult = buildPaginatedJobListResult(
    rows.map(mapJobListRow),
    safePage,
    pageSize,
    totalCount
  );
  writeCache(paginatedResultCache, cacheKey, pageResult);
  return pageResult;
}

export async function getActiveJobCount() {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    return getLocalActiveJobCount();
  }

  return getCachedCount("active-job-count", async () => {
    const [{ value }] = await getDb()
      .select({ value: count() })
      .from(jobsTable)
      .where(eq(jobsTable.pool, "active"));

    return value;
  });
}

export async function hasActiveJobs() {
  return (await getActiveJobCount()) > 0;
}

export async function getPotentialDuplicateCandidates(input: {
  company: string;
  roleTitle: string;
  link?: string;
  limit?: number;
  sinceDays?: number;
}) {
  await ensureDatabaseReady();

  const limit = input.limit ?? 120;
  const sinceDays = input.sinceDays ?? 365;
  const normalizedCompany = normalizeText(input.company);
  const link = input.link?.trim() ?? "";
  const roleTokenConditions = buildTokenSearchConditions(tokenize(input.roleTitle));
  const thresholdDate = getDateThreshold(sinceDays);

  if (shouldUseLocalFallback()) {
    const active = await getLocalJobsByPool("active");
    const roleTokens = tokenize(input.roleTitle).filter(
      (token) => token.length >= 3 && !tokenStopwords.has(token)
    );

    return active
      .filter((record) => new Date(record.timestamp).getTime() >= thresholdDate.getTime())
      .filter((record) => {
        const byCompany =
          normalizedCompany && normalizeText(record.company) === normalizedCompany;
        const byLink = Boolean(link && normalizeText(record.link) === normalizeText(link));
        const byRoleTokens =
          roleTokens.length > 0 &&
          roleTokens.some((token) =>
            normalizeText(
              `${record.roleTitle} ${record.company} ${record.location}`
            ).includes(token)
          );

        return byCompany || byLink || byRoleTokens;
      })
      .slice(0, limit);
  }

  const matchConditions = [
    normalizedCompany
      ? sql<boolean>`lower(${jobsTable.company}) = ${normalizedCompany}`
      : undefined,
    link ? eq(jobsTable.link, link) : undefined,
    ...roleTokenConditions
  ].filter((condition): condition is Exclude<typeof condition, undefined> =>
    Boolean(condition)
  );

  const whereClause = and(
    eq(jobsTable.pool, "active"),
    gte(jobsTable.timestamp, thresholdDate),
    ...(matchConditions.length > 0 ? [or(...matchConditions)] : [])
  );

  const seedRows = await getDb()
    .select({
      id: jobsTable.id
    })
    .from(jobsTable)
    .where(whereClause)
    .orderBy(desc(jobsTable.timestamp))
    .limit(limit);

  const ids = seedRows.map((row) => row.id);
  const rows = await getRowsByIdsInOrder(ids);
  return rows.map(mapJobRow);
}

export async function getEmailMatchCandidateRecords(input: {
  emailText: string;
  limit?: number;
  sinceDays?: number;
}) {
  await ensureDatabaseReady();

  const limit = input.limit ?? 180;
  const sinceDays = input.sinceDays ?? 365;
  const thresholdDate = getDateThreshold(sinceDays);
  const tokenConditions = buildTokenSearchConditions(tokenize(input.emailText));
  const hints = extractEmailMatchingHints(input.emailText);

  if (shouldUseLocalFallback()) {
    const active = (await getLocalJobsByPool("active")).filter(
      (record) => new Date(record.timestamp).getTime() >= thresholdDate.getTime()
    );
    const tokens = tokenize(input.emailText).filter(
      (token) => token.length >= 3 && !tokenStopwords.has(token)
    );
    const priority = active.filter((record) => {
      const companyText = normalizeText(record.company);
      const roleText = normalizeText(record.roleTitle);

      const byCompanyHint = hints.companyPhrases.some(
        (phrase) => companyText.includes(phrase)
      );
      const byRoleHint = hints.rolePhrases.some((phrase) =>
        roleText.includes(phrase)
      );

      return byCompanyHint || byRoleHint;
    });

    const broad =
      tokens.length === 0
        ? active
        : active.filter((record) => {
            const haystack = normalizeText(
              `${record.roleTitle} ${record.company} ${record.location} ${record.jobDescription}`
            );
            return tokens.some((token) => haystack.includes(token));
          });

    return [...priority, ...broad]
      .filter(
        (record, index, source) =>
          source.findIndex((entry) => entry.id === record.id) === index
      )
      .slice(0, limit);
  }

  const priorityConditions = [
    ...hints.companyPhrases.map((phrase) => {
      const escaped = escapeSqlLikeToken(phrase);
      return sql<boolean>`lower(${jobsTable.company}) like ${`%${escaped}%`} escape '\\'`;
    }),
    ...hints.rolePhrases.map((phrase) => {
      const escaped = escapeSqlLikeToken(phrase);
      return sql<boolean>`lower(${jobsTable.roleTitle}) like ${`%${escaped}%`} escape '\\'`;
    })
  ];

  const priorityIds =
    priorityConditions.length > 0
      ? (
          await getDb()
            .select({
              id: jobsTable.id
            })
            .from(jobsTable)
            .where(
              and(
                eq(jobsTable.pool, "active"),
                gte(jobsTable.timestamp, thresholdDate),
                or(...priorityConditions)
              )
            )
            .orderBy(desc(jobsTable.timestamp))
            .limit(Math.min(limit, 80))
        ).map((row) => row.id)
      : [];

  const broadWhereClause = and(
    eq(jobsTable.pool, "active"),
    gte(jobsTable.timestamp, thresholdDate),
    ...(tokenConditions.length > 0 ? [or(...tokenConditions)] : [])
  );

  const broadIds = (
    await getDb()
      .select({
        id: jobsTable.id
      })
      .from(jobsTable)
      .where(broadWhereClause)
      .orderBy(desc(jobsTable.timestamp))
      .limit(Math.min(Math.max(limit * 3, 360), 720))
  ).map((row) => row.id);

  const ids = uniqueValues([...priorityIds, ...broadIds]).slice(0, limit);
  const rows = await getRowsByIdsInOrder(ids);
  return rows.map(mapJobRow);
}

export async function insertJob(record: JobRecord) {
  await ensureDatabaseReady();

  const nextRecord = withAutoApplyMarker(record);

  if (shouldUseLocalFallback()) {
    await insertLocalJob(nextRecord);
    clearQueryCaches();
    return;
  }

  await getDb().insert(jobsTable).values({
    ...nextRecord,
    searchText: buildSearchText(nextRecord),
    timestamp: new Date(nextRecord.timestamp)
  });
  clearQueryCaches();
}

export async function insertJobsWithoutGoalEffects(records: JobRecord[]) {
  await ensureDatabaseReady();

  if (records.length === 0) {
    return;
  }

  if (shouldUseLocalFallback()) {
    await insertLocalJobsWithoutGoalEffects(records);
    clearQueryCaches();
    return;
  }

  await getDb().insert(jobsTable).values(
    records.map((record) => ({
      ...record,
      searchText: buildSearchText(record),
      applyCountedDateKey: record.applyCountedDateKey ?? null,
      timestamp: new Date(record.timestamp)
    }))
  );
  clearQueryCaches();
}

export async function updateJobRecord(record: JobRecord) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await updateLocalJobRecord(record);
    clearQueryCaches();
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
      searchText: buildSearchText(record),
      timestamp: new Date(record.timestamp),
      pool: record.pool,
      comments: record.comments,
      applyCountedDateKey: record.applyCountedDateKey,
      sourceType: record.sourceType,
      sourceConfidence: record.sourceConfidence,
      extractionStatus: record.extractionStatus
    })
    .where(eq(jobsTable.id, record.id));
  clearQueryCaches();
}

export async function updateComments(id: string, comments: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await updateLocalComments(id, comments);
    clearQueryCaches();
    return;
  }

  await getDb().update(jobsTable).set({ comments }).where(eq(jobsTable.id, id));
  clearQueryCaches();
}

export async function archiveJobRecord(id: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await archiveLocalJob(id);
    clearQueryCaches();
    return;
  }

  await getDb().update(jobsTable).set({ pool: "rejected" }).where(eq(jobsTable.id, id));
  clearQueryCaches();
}

export async function deleteJobRecord(id: string) {
  await ensureDatabaseReady();

  if (shouldUseLocalFallback()) {
    await deleteLocalJob(id);
    clearQueryCaches();
    return;
  }

  await getDb().delete(jobsTable).where(eq(jobsTable.id, id));
  clearQueryCaches();
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
  clearQueryCaches();

  return mapGoalsRow(row, autoApplyCount);
}

export async function repairTodayConnectGoalBaseline(input?: {
  count?: number;
  target?: number;
}) {
  await ensureDatabaseReady();

  const countValue = Math.max(0, Math.trunc(input?.count ?? 0));
  const targetValue = Math.max(1, Math.trunc(input?.target ?? 10));

  if (shouldUseLocalFallback()) {
    return repairLocalTodayConnectGoalBaseline({
      count: countValue,
      target: targetValue
    });
  }

  const row = await getTodayDailyGoalsRow();
  const autoApplyCount = await countAutoAppliedActiveRecordsForDate(row.dateKey);

  row.connectCount = countValue;
  row.connectTarget = targetValue;
  row.applyCount = computeDisplayedApplyCount(autoApplyCount, row.applyAdjustment);

  await persistDailyGoalsRow(row);
  clearQueryCaches();
  return mapGoalsRow(row, autoApplyCount);
}

export async function matchEmailAgainstActiveRecords(emailText: string) {
  const candidates = await getEmailMatchCandidateRecords({
    emailText,
    limit: 180,
    sinceDays: 365
  });

  return findEmailMatches(emailText, candidates);
}

export async function resetDatabaseForTests() {
  initialized = false;
  clearQueryCaches();

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
  clearQueryCaches();

  if (shouldUseLocalFallback()) {
    await resetLocalStoreToSeedState();
    initialized = true;
    return;
  }

  await ensurePostgresReady();
  const db = getDb();
  const seedState = getDefaultSeedState();

  await db.delete(dailyGoalsTable);
  await db.delete(jobsTable);

  await db.insert(jobsTable).values(
    [...seedState.activeJobs, ...seedState.rejectedJobs].map((record) => ({
      ...record,
      searchText: buildSearchText(record),
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
  clearQueryCaches();
}
