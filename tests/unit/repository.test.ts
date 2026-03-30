import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveJobRecord,
  deleteJobRecord,
  getActiveJobById,
  getActiveJobCount,
  getApplicationFlowSankeyData,
  getDailyGoalsState,
  getEmailMatchCandidateRecords,
  getJobsPage,
  getJobsByPool,
  matchEmailAgainstActiveRecords,
  getPotentialDuplicateCandidates,
  getRecentActiveJobs,
  hasActiveJobs,
  insertJobsWithoutGoalEffects,
  insertJob,
  repairTodayConnectGoalBaseline,
  resetCurrentEnvironmentToSeedState,
  resetDatabaseForTests,
  searchActiveJobsPage,
  updateComments,
  updateStage,
  updateDailyGoalState
} from "@/lib/db/repository";
import type { JobRecord } from "@/lib/types";

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";

describe("repository", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
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

  it("prefilters duplicate candidates before full similarity scoring", async () => {
    const candidates = await getPotentialDuplicateCandidates({
      company: "TikTok",
      roleTitle: "Data Analyst",
      limit: 2,
      sinceDays: 365
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(2);
    expect(candidates.every((record) => record.pool === "active")).toBe(true);
  });

  it("prefilters email matching candidates from active records only", async () => {
    const candidates = await getEmailMatchCandidateRecords({
      emailText:
        "Thank you for applying to TikTok for the Data Analyst position. We will not move forward.",
      limit: 5,
      sinceDays: 365
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(5);
    expect(candidates.every((record) => record.pool === "active")).toBe(true);
  });

  it("supports title + company query matching in Update by Email hybrid mode", async () => {
    const now = Date.now();
    const target: JobRecord = {
      id: "email-query-capital-one",
      roleTitle: "Senior Associate, Data Scientist - Applied AI",
      company: "Capital One",
      location: "McLean, Virginia, United States",
      link: "https://www.capitalonecareers.com/job/123",
      jobDescription:
        "Applied AI role supporting commercial credit modeling and experimentation.",
      timestamp: new Date(now - 60_000).toISOString(),
      pool: "active",
      stage: "applied",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "high",
      extractionStatus: "confirmed"
    };

    await insertJobsWithoutGoalEffects([target]);

    const matches = await matchEmailAgainstActiveRecords(
      "Senior Associate, Data Scientist - Applied AI Capital One"
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(10);
    expect(matches.some((item) => item.record.id === target.id)).toBe(true);
    const targetMatch = matches.find((item) => item.record.id === target.id);
    expect(targetMatch?.reasons.some((reason) => reason.includes("Matched"))).toBe(
      true
    );
  });

  it("returns hybrid Update by Email matches ordered by newest timestamp", async () => {
    const now = Date.now();
    const newer: JobRecord = {
      id: "email-query-order-newer",
      roleTitle: "Data Analyst",
      company: "Capital One",
      location: "New York, New York, United States",
      link: "",
      jobDescription: "Data Analyst role supporting card risk analytics.",
      timestamp: new Date(now).toISOString(),
      pool: "active",
      stage: "applied",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "confirmed"
    };
    const older: JobRecord = {
      ...newer,
      id: "email-query-order-older",
      timestamp: new Date(now - 86_400_000).toISOString()
    };

    await insertJobsWithoutGoalEffects([older, newer]);

    const matches = await matchEmailAgainstActiveRecords(
      "Data Analyst Capital One"
    );

    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(new Date(matches[0]?.record.timestamp ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(matches[1]?.record.timestamp ?? 0).getTime()
    );
  });

  it("keeps an older exact title+company query match visible with many recent noisy records", async () => {
    const now = Date.now();
    const noisyRecords: JobRecord[] = Array.from({ length: 120 }, (_, index) => ({
      id: `email-query-noise-${index}`,
      roleTitle: "Senior Associate, Data Scientist",
      company: `Noise Company ${index}`,
      location: "United States",
      link: "",
      jobDescription: "Data science role with analytics and modeling scope.",
      timestamp: new Date(now - index * 60_000).toISOString(),
      pool: "active",
      stage: "applied",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "confirmed"
    }));
    const target: JobRecord = {
      id: "email-query-older-capital-one",
      roleTitle: "Senior Associate, Data Scientist - Applied AI",
      company: "Capital One",
      location: "McLean, Virginia, United States",
      link: "",
      jobDescription: "Applied AI role for commercial credit risk modeling.",
      timestamp: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
      pool: "active",
      stage: "applied",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "confirmed"
    };

    await insertJobsWithoutGoalEffects([...noisyRecords, target]);

    const matches = await matchEmailAgainstActiveRecords(
      "Senior Associate, Data Scientist - Applied AI Capital One"
    );

    expect(matches.some((item) => item.record.id === target.id)).toBe(true);
    expect(matches.length).toBeLessThanOrEqual(10);
  });

  it("keeps older exact company/role email targets in candidates despite recent noisy matches", async () => {
    const now = Date.now();
    const noisyRecords: JobRecord[] = Array.from({ length: 190 }, (_, index) => ({
      id: `email-noise-${index}`,
      roleTitle: "Data Analyst",
      company: `Noise Company ${index}`,
      location: "United States",
      link: "",
      jobDescription:
        "Thank you for your interest in this Data Analyst position. We reviewed your application and will pursue other applicants.",
      timestamp: new Date(now - index * 60_000).toISOString(),
      pool: "active",
      stage: "applied",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "confirmed"
    }));

    const target: JobRecord = {
      id: "email-target-ttx",
      roleTitle: "Data Analyst III",
      company: "TTX Company",
      location: "Charlotte, NC",
      link: "",
      jobDescription:
        "Billing transformation analyst role for enterprise data and reporting.",
      timestamp: new Date(now - 300 * 24 * 60 * 60 * 1000).toISOString(),
      pool: "active",
      stage: "applied",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "confirmed"
    };

    await insertJobsWithoutGoalEffects([...noisyRecords, target]);

    const candidates = await getEmailMatchCandidateRecords({
      emailText:
        "Thank you for your interest in the Data Analyst III position at TTX Company. We decided to pursue other applicants.",
      limit: 180,
      sinceDays: 365
    });

    expect(candidates.some((record) => record.id === target.id)).toBe(true);
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

  it("updates stage explicitly and preserves it through archive", async () => {
    const active = await getJobsByPool("active");
    const target = active[0];

    await updateStage(target.id, "oa");

    const staged = await getActiveJobById(target.id);
    expect(staged?.stage).toBe("oa");

    await archiveJobRecord(target.id);

    const rejected = await getJobsByPool("rejected");
    const archived = rejected.find((item) => item.id === target.id);
    expect(archived?.stage).toBe("oa");
  });

  it("aggregates application flow into applied -> stage -> pool links", async () => {
    await insertJobsWithoutGoalEffects([
      {
        id: "sankey-active-applied",
        roleTitle: "Analytics Intern",
        company: "Flow Co",
        location: "Remote",
        link: "",
        jobDescription: "Entry-level analytics role.",
        timestamp: "2026-03-01T12:00:00.000Z",
        pool: "active",
        stage: "applied",
        comments: "",
        applyCountedDateKey: null,
        sourceType: "company",
        sourceConfidence: "high",
        extractionStatus: "confirmed"
      },
      {
        id: "sankey-rejected-oa",
        roleTitle: "Data Analyst",
        company: "Flow Co",
        location: "Remote",
        link: "",
        jobDescription: "Assessment-heavy analyst role.",
        timestamp: "2026-03-02T12:00:00.000Z",
        pool: "rejected",
        stage: "oa",
        comments: "Completed OA",
        applyCountedDateKey: null,
        sourceType: "linkedin",
        sourceConfidence: "high",
        extractionStatus: "confirmed"
      }
    ]);

    const sankey = await getApplicationFlowSankeyData();
    const appliedActive = sankey.links.find(
      (entry) =>
        entry.stage === "applied" &&
        entry.pool === "active"
    );
    const oaRejected = sankey.links.find(
      (entry) =>
        entry.stage === "oa" &&
        entry.pool === "rejected"
    );
    const preview = sankey.records.find((record) => record.id === "sankey-rejected-oa");

    expect(sankey.totalRecords).toBeGreaterThanOrEqual(2);
    expect(appliedActive?.count).toBeGreaterThanOrEqual(1);
    expect(oaRejected?.count).toBeGreaterThanOrEqual(1);
    expect(preview?.commentsPreview).toContain("Completed OA");
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

  it("starts connect with a 0/10 daily baseline", async () => {
    const initial = await getDailyGoalsState();

    expect(initial.goals.connect.count).toBe(0);
    expect(initial.goals.connect.target).toBe(10);
  });

  it("can repair today's connect goal back to 0/10", async () => {
    await updateDailyGoalState({
      goal: "connect",
      kind: "increment"
    });
    await updateDailyGoalState({
      goal: "connect",
      kind: "target",
      value: 12
    });

    const repaired = await repairTodayConnectGoalBaseline({
      count: 0,
      target: 10
    });

    expect(repaired.goals.connect.count).toBe(0);
    expect(repaired.goals.connect.target).toBe(10);
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
      stage: "applied",
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
      stage: "applied",
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
      stage: "applied",
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
        stage: "applied",
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
        stage: "applied",
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
        stage: "applied",
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

  it("restores the default seed baseline when the environment is reset", async () => {
    await deleteJobRecord("seed-active-3");
    await updateDailyGoalState({
      goal: "apply",
      kind: "increment"
    });

    await resetCurrentEnvironmentToSeedState();

    const restoredActive = await getJobsByPool("active");
    const restoredGoals = await getDailyGoalsState();

    expect(restoredActive.some((job) => job.id === "seed-active-3")).toBe(true);
    expect(restoredGoals.goals.apply.target).toBe(50);
    expect(restoredGoals.goals.connect.target).toBe(10);
  });
});
