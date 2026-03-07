import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedActiveJobs, seedDailyGoals, seedRejectedJobs } from "@/lib/seed";
import type {
  DailyGoalsState,
  GoalKey,
  JobPool,
  JobRecord
} from "@/lib/types";
import { getEasternDateKey } from "@/lib/utils";

type DailyGoalsRow = {
  dateKey: string;
  applyCount: number;
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

function goalsFromRow(row: DailyGoalsRow): DailyGoalsState {
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

function goalSeedForToday(): DailyGoalsRow {
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

function shouldSeedLocalStore() {
  return process.env.JOB_DESK_ENABLE_SEED === "true" || process.env.NODE_ENV !== "production";
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
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    dailyGoals: Array.isArray(parsed.dailyGoals) ? parsed.dailyGoals : []
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

    store.jobs = [...seedActiveJobs, ...seedRejectedJobs];
    if (!store.dailyGoals.some((row) => row.dateKey === getEasternDateKey())) {
      store.dailyGoals.push(goalSeedForToday());
    }
  });
}

export async function getLocalJobsByPool(pool: JobPool) {
  const store = await readLocalStore();
  return store.jobs
    .filter((job) => job.pool === pool)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function insertLocalJob(record: JobRecord) {
  await mutateLocalStore(async (store) => {
    store.jobs.push(record);

    if (record.pool === "active") {
      const today = getEasternDateKey();
      const existing = store.dailyGoals.find((row) => row.dateKey === today);
      if (existing) {
        existing.applyCount += 1;
      } else {
        const seeded = goalSeedForToday();
        seeded.applyCount = 1;
        store.dailyGoals.push(seeded);
      }
    }
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

export async function getLocalDailyGoalsState() {
  const today = getEasternDateKey();

  return mutateLocalStore(async (store) => {
    const existing = store.dailyGoals.find((row) => row.dateKey === today);
    if (existing) {
      return goalsFromRow(existing);
    }

    const seeded = goalSeedForToday();
    store.dailyGoals.push(seeded);
    return goalsFromRow(seeded);
  });
}

export async function updateLocalDailyGoalState(input: {
  goal: GoalKey;
  kind: "increment" | "target";
  value?: number;
}) {
  const current = await getLocalDailyGoalsState();
  const next = structuredClone(current);

  if (input.kind === "increment") {
    next.goals[input.goal].count += 1;
  } else if (typeof input.value === "number" && input.value > 0) {
    next.goals[input.goal].target = input.value;
  }

  await mutateLocalStore(async (store) => {
    const existing = store.dailyGoals.find((row) => row.dateKey === next.dateKey);
    const row: DailyGoalsRow = {
      dateKey: next.dateKey,
      applyCount: next.goals.apply.count,
      applyTarget: next.goals.apply.target,
      connectCount: next.goals.connect.count,
      connectTarget: next.goals.connect.target,
      followCount: next.goals.follow.count,
      followTarget: next.goals.follow.target
    };

    if (existing) {
      Object.assign(existing, row);
    } else {
      store.dailyGoals.push(row);
    }
  });

  return next;
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
