import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveJobRecord,
  deleteJobRecord,
  getActiveJobById,
  getActiveJobCount,
  getDailyGoalsState,
  getJobsPage,
  getJobsByPool,
  getRecentActiveJobs,
  hasActiveJobs,
  insertJobsWithoutGoalEffects,
  insertJob,
  resetCurrentEnvironmentToSeedState,
  resetDatabaseForTests,
  searchActiveJobsPage,
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

  it("returns recent active jobs as lightweight preview rows", async () => {
    const active = await getJobsByPool("active");
    const recent = await getRecentActiveJobs(2);

    expect(recent).toHaveLength(2);
    expect(recent[0]?.timestamp >= recent[1]?.timestamp).toBe(true);
    expect(recent[0]?.jobDescriptionPreview.length).toBeLessThanOrEqual(
      active[0]?.jobDescription.length ?? 10_000
    );
    expect("jobDescription" in recent[0]).toBe(false);
  });

  it("returns paginated pool rows without full job descriptions", async () => {
    const page = await getJobsPage({
      pool: "active",
      page: 1,
      pageSize: 2
    });

    expect(page.records).toHaveLength(2);
    expect(page.totalCount).toBeGreaterThanOrEqual(2);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(2);
    expect(page.totalPages).toBeGreaterThanOrEqual(1);
    expect("jobDescription" in page.records[0]).toBe(false);
  });

  it("searches Active records in the repository layer and paginates results", async () => {
    const page = await searchActiveJobsPage({
      query: "TikTok Data Analyst",
      page: 1,
      pageSize: 5
    });

    expect(page.records.length).toBeGreaterThan(0);
    expect(page.records.every((record) => record.company.includes("TikTok"))).toBe(true);
    expect(page.records.every((record) => "jobDescription" in record === false)).toBe(true);
  });

  it("returns active counts without loading full records into the page layer", async () => {
    const active = await getJobsByPool("active");
    const count = await getActiveJobCount();

    expect(count).toBe(active.length);
    expect(await hasActiveJobs()).toBe(true);
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
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review"
    };

    await insertJob(record);
    const next = await getDailyGoalsState();

    expect(next.goals.apply.count).toBe(initial.goals.apply.count + 1);
  });

  it("rolls back Apply when a same-day auto-counted record is deleted", async () => {
    const initial = await getDailyGoalsState();
    const record: JobRecord = {
      id: "daily-goal-delete-rollback",
      roleTitle: "Delete Rollback Analyst",
      company: "Goal Test Co",
      location: "Remote",
      link: "",
      jobDescription: "Verify apply goals decrement when same-day records are deleted.",
      timestamp: new Date().toISOString(),
      pool: "active",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review"
    };

    await insertJob(record);
    await deleteJobRecord(record.id);

    const next = await getDailyGoalsState();
    expect(next.goals.apply.count).toBe(initial.goals.apply.count);
  });

  it("rolls back Apply when a same-day auto-counted record is archived", async () => {
    const initial = await getDailyGoalsState();
    const record: JobRecord = {
      id: "daily-goal-archive-rollback",
      roleTitle: "Archive Rollback Analyst",
      company: "Goal Test Co",
      location: "Remote",
      link: "",
      jobDescription: "Verify apply goals decrement when same-day records are archived.",
      timestamp: new Date().toISOString(),
      pool: "active",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review"
    };

    await insertJob(record);
    await archiveJobRecord(record.id);

    const next = await getDailyGoalsState();
    expect(next.goals.apply.count).toBe(initial.goals.apply.count);
  });

  it("does not roll back Apply for historical imports that never auto-counted", async () => {
    const initial = await getDailyGoalsState();

    await insertJobsWithoutGoalEffects([
      {
        id: "historical-no-rollback",
        roleTitle: "Historical Analyst",
        company: "Archive Co",
        location: "Remote",
        link: "",
        jobDescription: "Imported from curated workbook data.",
        timestamp: "2025-10-01T12:00:00.000Z",
        pool: "active",
        comments: "Historical import",
        applyCountedDateKey: null,
        sourceType: "unknown",
        sourceConfidence: "high",
        extractionStatus: "confirmed"
      }
    ]);

    await deleteJobRecord("historical-no-rollback");

    const next = await getDailyGoalsState();
    expect(next).toEqual(initial);
  });

  it("preserves daily goals during bulk historical imports", async () => {
    const initialGoals = await getDailyGoalsState();
    const beforeCount = (await getJobsByPool("active")).length;

    await insertJobsWithoutGoalEffects([
      {
        id: "historical-import-1",
        roleTitle: "Historical Analyst",
        company: "Archive Co",
        location: "Remote",
        link: "",
        jobDescription: "Imported from curated workbook data.",
        timestamp: "2025-10-01T12:00:00.000Z",
        pool: "active",
        comments: "Historical import",
        applyCountedDateKey: null,
        sourceType: "unknown",
        sourceConfidence: "high",
        extractionStatus: "confirmed"
      },
      {
        id: "historical-import-2",
        roleTitle: "Historical Rejected Analyst",
        company: "Archive Co",
        location: "Toronto, ON",
        link: "",
        jobDescription: "Imported from curated workbook data.",
        timestamp: "2025-11-01T12:00:00.000Z",
        pool: "rejected",
        comments: "",
        applyCountedDateKey: null,
        sourceType: "unknown",
        sourceConfidence: "high",
        extractionStatus: "confirmed"
      }
    ]);

    const nextGoals = await getDailyGoalsState();
    const nextCount = (await getJobsByPool("active")).length;

    expect(nextGoals).toEqual(initialGoals);
    expect(nextCount).toBe(beforeCount + 1);
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
