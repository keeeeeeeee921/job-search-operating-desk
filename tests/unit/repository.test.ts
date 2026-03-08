import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveJobRecord,
  deleteJobRecord,
  getActiveJobById,
  getDailyGoalsState,
  getJobsByPool,
  insertJob,
  resetCurrentEnvironmentToSeedState,
  resetDatabaseForTests,
  updateComments,
  updateDailyGoalState
} from "@/lib/db/repository";
import type { JobRecord } from "@/lib/types";

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";
const originalPublicDemo = process.env.JOB_DESK_PUBLIC_DEMO;

describe("repository", () => {
  beforeEach(async () => {
    process.env.JOB_DESK_PUBLIC_DEMO = "false";
    await resetDatabaseForTests();
  });

  afterEach(() => {
    if (originalPublicDemo === undefined) {
      delete process.env.JOB_DESK_PUBLIC_DEMO;
      return;
    }

    process.env.JOB_DESK_PUBLIC_DEMO = originalPublicDemo;
  });

  it("loads seeded active and rejected records from the database", async () => {
    const active = await getJobsByPool("active");
    const rejected = await getJobsByPool("rejected");

    expect(active.length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("updates comments and archives records", async () => {
    const active = await getJobsByPool("active");
    const target = active[0];

    await updateComments(target.id, "Second round interview");
    const updated = await getActiveJobById(target.id);
    expect(updated?.comments).toBe("Second round interview");

    await archiveJobRecord(target.id);
    const afterArchive = await getActiveJobById(target.id);
    const rejected = await getJobsByPool("rejected");

    expect(afterArchive).toBeNull();
    expect(rejected.some((item) => item.id === target.id)).toBe(true);
  });

  it("deletes records permanently", async () => {
    const active = await getJobsByPool("active");
    const target = active[0];

    await deleteJobRecord(target.id);

    const afterDelete = await getActiveJobById(target.id);
    const nextActive = await getJobsByPool("active");
    const rejected = await getJobsByPool("rejected");

    expect(afterDelete).toBeNull();
    expect(nextActive.some((item) => item.id === target.id)).toBe(false);
    expect(rejected.some((item) => item.id === target.id)).toBe(false);
  });

  it("increments and updates daily goals in the database", async () => {
    const initial = await getDailyGoalsState();
    const incremented = await updateDailyGoalState({
      goal: "apply",
      kind: "increment"
    });
    const targeted = await updateDailyGoalState({
      goal: "follow",
      kind: "target",
      value: 5
    });

    expect(incremented.goals.apply.count).toBe(initial.goals.apply.count + 1);
    expect(targeted.goals.follow.target).toBe(5);
  });

  it("increments apply automatically when a new Active record is inserted", async () => {
    const initial = await getDailyGoalsState();
    const record: JobRecord = {
      id: "daily-goal-auto-apply",
      roleTitle: "Auto Apply Analyst",
      company: "Goal Test Co",
      location: "Remote",
      link: "",
      jobDescription: "Verify apply goals increment when Active records are added.",
      timestamp: new Date().toISOString(),
      pool: "active",
      comments: "",
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review"
    };

    await insertJob(record);
    const next = await getDailyGoalsState();

    expect(next.goals.apply.count).toBe(initial.goals.apply.count + 1);
  });

  it("restores the curated demo baseline when demo state is reset", async () => {
    process.env.JOB_DESK_PUBLIC_DEMO = "true";

    await resetCurrentEnvironmentToSeedState();
    const demoActive = await getJobsByPool("active");
    expect(demoActive.some((job) => job.company === "Pi3AI")).toBe(true);

    await deleteJobRecord("demo-active-3");
    await updateDailyGoalState({
      goal: "apply",
      kind: "increment"
    });

    await resetCurrentEnvironmentToSeedState();

    const restoredActive = await getJobsByPool("active");
    const restoredGoals = await getDailyGoalsState();

    expect(restoredActive.some((job) => job.id === "demo-active-3")).toBe(true);
    expect(restoredGoals.goals.apply.count).toBe(3);
    expect(restoredGoals.goals.apply.target).toBe(6);
  });
});
