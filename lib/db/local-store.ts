import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPublicDemo } from "@/lib/demo";
import {
  buildPaginatedJobListResult,
  normalizePageNumber,
  toJobListItem
} from "@/lib/job-list";
import { DAILY_GOALS_DEFAULTS } from "@/lib/daily-goals-defaults";
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

type DailyGoalsRow = {
  dateKey: string;
  applyCount: number;
  applyAdjustment: number;
  applyTarget: number;
  connectCount: number;
  connectTarget: number;
  followCount: number;
  followTarget: number;
};

type LocalStore = {
  version: 1;
  jobs: JobRecord[];
  dailyGoals: DailyGoalsRow[];
};

let localWriteQueue = Promise.resolve();

function computeDisplayedApplyCount(autoCount: number, applyAdjustment: number) {
  return Math.max(0, autoCount + applyAdjustment);
}

function countAutoAppliedActiveRecordsForDate(store: LocalStore, dateKey: string) {
  return store.jobs.filter(
    (job) => job.pool === "active" && job.applyCountedDateKey === dateKey
  ).length;
}

function goalsFromRow(row: DailyGoalsRow, autoApplyCount: number): DailyGoalsState {
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

function goalSeedForToday(): DailyGoalsRow {
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

function shouldSeedLocalStore() {
  return (
    isPublicDemo() ||
    process.env.JOB_DESK_ENABLE_SEED === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

function getLocalDataDir() {
  return process.env.JOB_DESK_DB_DIR
    ? path.resolve(process.cwd(), process.env.JOB_DESK_DB_DIR)
    : path.join(process.cwd(), ".data", "job-desk-db");
}

function getLocalStorePath() {
  return path.join(getLocalDataDir(), "job-desk.json");
}

function createEmptyStore(): LocalStore {
  return {
    version: 1,
    jobs: [],
    dailyGoals: []
  };
}

async function withLocalWriteLock<T>(callback: () => Promise<T>) {
  const next = localWriteQueue.then(callback);
  localWriteQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function ensureLocalStoreReady() {
  const storePath = getLocalStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

async function readLocalStore(): Promise<LocalStore> {
  await ensureLocalStoreReady();
  const raw = await readFile(getLocalStorePath(), "utf8");
  const parsed = JSON.parse(raw) as Partial<LocalStore>;

  return {
    version: 1,
    jobs: Array.isArray(parsed.jobs)
      ? parsed.jobs.map((job) => ({
          ...job,
          applyCountedDateKey: job.applyCountedDateKey ?? null
        }))
      : [],
    dailyGoals: Array.isArray(parsed.dailyGoals)
      ? parsed.dailyGoals.map((row) => ({
          ...row,
          applyAdjustment:
            typeof row.applyAdjustment === "number"
              ? row.applyAdjustment
              : typeof row.applyCount === "number"
                ? row.applyCount
                : 0
        }))
      : []
  };
}

async function writeLocalStore(store: LocalStore) {
  const storePath = getLocalStorePath();
  const tempPath = `${storePath}.tmp`;
  await ensureLocalStoreReady();
  await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tempPath, storePath);
}

async function mutateLocalStore<T>(
  callback: (store: LocalStore) => Promise<T> | T
): Promise<T> {
  return withLocalWriteLock(async () => {
    const store = await readLocalStore();
    const result = await callback(store);
    await writeLocalStore(store);
    return result;
  });
}

export async function seedLocalStoreIfNeeded() {
  await mutateLocalStore(async (store) => {
    if (!shouldSeedLocalStore() || store.jobs.length > 0) {
      return;
    }

    const seedState = getSeedStateForEnvironment();
    store.jobs = [...seedState.activeJobs, ...seedState.rejectedJobs];
    if (!store.dailyGoals.some((row) => row.dateKey === getEasternDateKey())) {
      store.dailyGoals.push(goalSeedForToday());
    }
  });
}

export async function resetLocalStoreToSeedState() {
  const seedState = getSeedStateForEnvironment();

  await mutateLocalStore(async (store) => {
    store.jobs = [...seedState.activeJobs, ...seedState.rejectedJobs];
    store.dailyGoals = [
      {
        dateKey: seedState.dailyGoals.dateKey,
        applyCount: seedState.dailyGoals.goals.apply.count,
        applyAdjustment: seedState.dailyGoals.goals.apply.count,
        applyTarget: seedState.dailyGoals.goals.apply.target,
        connectCount: seedState.dailyGoals.goals.connect.count,
        connectTarget: seedState.dailyGoals.goals.connect.target,
        followCount: seedState.dailyGoals.goals.follow.count,
        followTarget: seedState.dailyGoals.goals.follow.target
      }
    ];
  });
}

export async function getLocalJobsByPool(pool: JobPool) {
  const store = await readLocalStore();
  return store.jobs
    .filter((job) => job.pool === pool)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getLocalRecentActiveJobs(limit: number): Promise<JobListItem[]> {
  const jobs = await getLocalJobsByPool("active");
  return jobs.slice(0, limit).map(toJobListItem);
}

export async function getLocalActiveJobById(id: string) {
  const store = await readLocalStore();
  const record = store.jobs.find((job) => job.pool === "active" && job.id === id);
  return record ?? null;
}

export async function getLocalJobsPage(input: {
  pool: JobPool;
  page: number;
  pageSize: number;
}): Promise<PaginatedJobListResult> {
  const records = await getLocalJobsByPool(input.pool);
  const totalCount = records.length;
  const page = normalizePageNumber(input.page);
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * input.pageSize;
  const items = records.slice(start, start + input.pageSize).map(toJobListItem);

  return buildPaginatedJobListResult(items, safePage, input.pageSize, totalCount);
}

export async function searchLocalActiveJobsPage(input: {
  query: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedJobListResult> {
  const records = await getLocalJobsByPool("active");
  const normalizedQuery = normalizeText(input.query);
  const filtered = normalizedQuery
    ? records.filter((record) =>
        normalizeText(
          `${record.company} ${record.roleTitle} ${record.location}`
        ).includes(normalizedQuery)
      )
    : records;
  const totalCount = filtered.length;
  const page = normalizePageNumber(input.page);
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * input.pageSize;
  const items = filtered.slice(start, start + input.pageSize).map(toJobListItem);

  return buildPaginatedJobListResult(items, safePage, input.pageSize, totalCount);
}

export async function getLocalActiveJobCount() {
  const store = await readLocalStore();
  return store.jobs.filter((job) => job.pool === "active").length;
}

export async function insertLocalJob(record: JobRecord) {
  await mutateLocalStore(async (store) => {
    const nextRecord = withAutoApplyMarker(record);
    store.jobs.push(nextRecord);
  });
}

export async function insertLocalJobsWithoutGoalEffects(records: JobRecord[]) {
  if (records.length === 0) {
    return;
  }

  await mutateLocalStore(async (store) => {
    store.jobs.push(
      ...records.map((record) => ({
        ...record,
        applyCountedDateKey: record.applyCountedDateKey ?? null
      }))
    );
  });
}

export async function updateLocalComments(id: string, comments: string) {
  await mutateLocalStore(async (store) => {
    const target = store.jobs.find((job) => job.id === id);
    if (target) {
      target.comments = comments;
    }
  });
}

export async function archiveLocalJob(id: string) {
  await mutateLocalStore(async (store) => {
    const target = store.jobs.find((job) => job.id === id);
    if (target) {
      target.pool = "rejected";
    }
  });
}

export async function deleteLocalJob(id: string) {
  await mutateLocalStore(async (store) => {
    store.jobs = store.jobs.filter((job) => job.id !== id);
  });
}

export async function updateLocalJobRecord(record: JobRecord) {
  await mutateLocalStore(async (store) => {
    store.jobs = store.jobs.map((job) =>
      job.id === record.id
        ? {
            ...record,
            applyCountedDateKey: record.applyCountedDateKey ?? null
          }
        : job
    );
  });
}

export async function getLocalDailyGoalsState() {
  const today = getEasternDateKey();

  return mutateLocalStore(async (store) => {
    const existing = store.dailyGoals.find((row) => row.dateKey === today);
    if (existing) {
      return goalsFromRow(existing, countAutoAppliedActiveRecordsForDate(store, today));
    }

    const seeded = goalSeedForToday();
    store.dailyGoals.push(seeded);
    return goalsFromRow(seeded, countAutoAppliedActiveRecordsForDate(store, today));
  });
}

export async function updateLocalDailyGoalState(input: {
  goal: GoalKey;
  kind: "increment" | "target";
  value?: number;
}) {
  const today = getEasternDateKey();

  return mutateLocalStore(async (store) => {
    let row = store.dailyGoals.find((entry) => entry.dateKey === today);
    if (!row) {
      row = goalSeedForToday();
      store.dailyGoals.push(row);
    }

    const autoApplyCount = countAutoAppliedActiveRecordsForDate(store, today);

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
    return goalsFromRow(row, autoApplyCount);
  });
}

export async function repairLocalTodayConnectGoalBaseline(input?: {
  count?: number;
  target?: number;
}) {
  const today = getEasternDateKey();
  const countValue = Math.max(0, Math.trunc(input?.count ?? 0));
  const targetValue = Math.max(1, Math.trunc(input?.target ?? 10));

  return mutateLocalStore(async (store) => {
    let row = store.dailyGoals.find((entry) => entry.dateKey === today);
    if (!row) {
      row = goalSeedForToday();
      store.dailyGoals.push(row);
    }

    const autoApplyCount = countAutoAppliedActiveRecordsForDate(store, today);

    row.connectCount = countValue;
    row.connectTarget = targetValue;
    row.applyCount = computeDisplayedApplyCount(autoApplyCount, row.applyAdjustment);

    return goalsFromRow(row, autoApplyCount);
  });
}

export async function resetLocalStoreForTests() {
  await rm(getLocalStorePath(), { force: true });
  await ensureLocalStoreReady();
  await seedLocalStoreIfNeeded();
}

export async function getAllLocalRecords() {
  const store = await readLocalStore();
  return [...store.jobs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
