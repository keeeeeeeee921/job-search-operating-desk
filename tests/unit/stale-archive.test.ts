import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveStaleActiveJobs,
  findStaleActiveJobs,
  getJobsByPool,
  getSearchLogAnalytics,
  insertJobsWithoutGoalEffects,
  resetDatabaseForTests
} from "@/lib/db/repository";
import {
  resetStaleArchiveSweepForTests,
  runStaleArchiveSweepIfDue,
  STALE_ARCHIVE_SWEEP_INTERVAL_MS
} from "@/lib/server/stale-archive-sweep";
import {
  appendSystemNote,
  buildAutoArchiveNote,
  getStaleActiveThreshold,
  isStaleActiveRecord
} from "@/lib/stale-archive";
import type { JobRecord } from "@/lib/types";

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";

const NOW = new Date("2026-10-13T15:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function buildRecord(
  id: string,
  overrides: Partial<JobRecord> & Pick<JobRecord, "timestamp">
): JobRecord {
  return {
    id,
    roleTitle: `Role ${id}`,
    company: `Company ${id}`,
    location: "Remote",
    link: "",
    jobDescription: "Analyst role.",
    pool: "active",
    stage: "no_response",
    searchCycleLabel: null,
    comments: "",
    applyCountedDateKey: null,
    sourceType: "company",
    sourceConfidence: "high",
    extractionStatus: "confirmed",
    ...overrides
  };
}

const exactlyOneYear = new Date(NOW.getTime() - 365 * DAY_MS).toISOString();
const justOverOneYear = new Date(NOW.getTime() - 365 * DAY_MS - 1000).toISOString();
const twoYears = new Date(NOW.getTime() - 730 * DAY_MS).toISOString();

async function seedBoundaryRecords() {
  await insertJobsWithoutGoalEffects([
    buildRecord("stale-exact-365", { timestamp: exactlyOneYear }),
    buildRecord("stale-over-365", { timestamp: justOverOneYear }),
    buildRecord("stale-two-years-with-note", {
      timestamp: twoYears,
      comments: "Applied via referral."
    }),
    buildRecord("stale-but-interviewing", {
      timestamp: twoYears,
      stage: "round_2"
    }),
    buildRecord("already-rejected", {
      timestamp: twoYears,
      pool: "rejected",
      stage: "rejected"
    })
  ]);
}

describe("stale active archive rules", () => {
  it("only matches Active + No Response records saved strictly more than 365 days ago", () => {
    expect(getStaleActiveThreshold(NOW).toISOString()).toBe(exactlyOneYear);
    expect(
      isStaleActiveRecord({ pool: "active", stage: "no_response", timestamp: exactlyOneYear }, NOW)
    ).toBe(false);
    expect(
      isStaleActiveRecord({ pool: "active", stage: "no_response", timestamp: justOverOneYear }, NOW)
    ).toBe(true);
    expect(
      isStaleActiveRecord({ pool: "active", stage: "round_1", timestamp: twoYears }, NOW)
    ).toBe(false);
    expect(
      isStaleActiveRecord({ pool: "rejected", stage: "no_response", timestamp: twoYears }, NOW)
    ).toBe(false);
  });

  it("writes the system note with the saved date and keeps existing comments", () => {
    const note = buildAutoArchiveNote("2025-09-06T18:00:00.000Z");
    expect(note).toBe("Auto-archived: no response for over a year (saved Sep 6, 2025)");
    expect(appendSystemNote("", note)).toBe(note);
    expect(appendSystemNote("Applied via referral.\n", note)).toBe(
      `Applied via referral.\n${note}`
    );
  });
});

describe("stale active archive in the repository", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    await seedBoundaryRecords();
  });

  it("finds and archives only the stale No Response records", async () => {
    const stale = await findStaleActiveJobs(NOW);
    expect(stale.map((record) => record.id).sort()).toEqual([
      "stale-over-365",
      "stale-two-years-with-note"
    ]);

    const { archivedIds } = await archiveStaleActiveJobs(NOW);
    expect(archivedIds.sort()).toEqual(["stale-over-365", "stale-two-years-with-note"]);

    const active = await getJobsByPool("active");
    const rejected = await getJobsByPool("rejected");

    const seedActiveIds = active
      .map((record) => record.id)
      .filter((id) => id.startsWith("seed-"));
    expect(seedActiveIds.length).toBeGreaterThan(0);
    expect(active.map((record) => record.id).sort()).toEqual(
      [...seedActiveIds, "stale-but-interviewing", "stale-exact-365"].sort()
    );

    const archived = rejected.find((record) => record.id === "stale-over-365");
    expect(archived?.stage).toBe("rejected");
    expect(archived?.comments).toBe(buildAutoArchiveNote(justOverOneYear));

    const archivedWithNote = rejected.find(
      (record) => record.id === "stale-two-years-with-note"
    );
    expect(archivedWithNote?.comments).toBe(
      `Applied via referral.\n${buildAutoArchiveNote(twoYears)}`
    );

    expect(await findStaleActiveJobs(NOW)).toHaveLength(0);
  });

  it("counts auto-archived records under Rejected in the Search Log analytics", async () => {
    const before = await getSearchLogAnalytics(9);
    const rejectedBefore =
      before.cycles
        .find((cycle) => cycle.label === "Search 01")
        ?.buckets.find((bucket) => bucket.pool === "rejected" && bucket.stage === "rejected")
        ?.count ?? 0;

    await archiveStaleActiveJobs(NOW);

    const after = await getSearchLogAnalytics(9);
    const rejectedAfter =
      after.cycles
        .find((cycle) => cycle.label === "Search 01")
        ?.buckets.find((bucket) => bucket.pool === "rejected" && bucket.stage === "rejected")
        ?.count ?? 0;

    expect(rejectedAfter).toBe(rejectedBefore + 2);
  });
});

describe("stale archive sweep", () => {
  beforeEach(async () => {
    resetStaleArchiveSweepForTests();
    await resetDatabaseForTests();
    await seedBoundaryRecords();
  });

  afterEach(() => {
    delete process.env.JOB_DESK_PUBLIC_DEMO;
    resetStaleArchiveSweepForTests();
  });

  it("runs once, then throttles for 24 hours", async () => {
    expect(await runStaleArchiveSweepIfDue(NOW)).toEqual({ status: "ran", archivedCount: 2 });

    await insertJobsWithoutGoalEffects([
      buildRecord("stale-added-later", { timestamp: twoYears })
    ]);

    const soon = new Date(NOW.getTime() + STALE_ARCHIVE_SWEEP_INTERVAL_MS - 1);
    expect(await runStaleArchiveSweepIfDue(soon)).toEqual({
      status: "skipped",
      reason: "throttled"
    });
    expect((await getJobsByPool("active")).some((record) => record.id === "stale-added-later")).toBe(
      true
    );

    // A day later the record that was exactly 365 days old has crossed the
    // line too, so the sweep picks up both it and the newly inserted one.
    const nextDay = new Date(NOW.getTime() + STALE_ARCHIVE_SWEEP_INTERVAL_MS);
    expect(await runStaleArchiveSweepIfDue(nextDay)).toEqual({ status: "ran", archivedCount: 2 });
    const rejectedIds = (await getJobsByPool("rejected")).map((record) => record.id);
    expect(rejectedIds).toContain("stale-added-later");
    expect(rejectedIds).toContain("stale-exact-365");
  });

  it("does nothing in the public demo", async () => {
    process.env.JOB_DESK_PUBLIC_DEMO = "true";

    expect(await runStaleArchiveSweepIfDue(NOW)).toEqual({ status: "skipped", reason: "demo" });

    delete process.env.JOB_DESK_PUBLIC_DEMO;
    expect(await findStaleActiveJobs(NOW)).toHaveLength(2);
  });
});
