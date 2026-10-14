import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

// Simulate a Vercel deployment that has a real database configured but is
// flagged as the public demo: nothing may touch DATABASE_URL.
beforeAll(() => {
  process.env.JOB_DESK_PUBLIC_DEMO = "true";
  process.env.DATABASE_URL = "postgres://demo-must-not-connect@127.0.0.1:1/none";
  process.env.VERCEL = "1";
  process.env.JOB_DESK_DB_DIR = ".data/job-desk-demo-vitest";
});

afterAll(() => {
  delete process.env.JOB_DESK_PUBLIC_DEMO;
  delete process.env.DATABASE_URL;
  delete process.env.VERCEL;
});

describe("public demo mode", () => {
  it("serves the seed data set without touching the database", async () => {
    const { getJobsByPool } = await import("@/lib/db/repository");
    const { getDefaultSeedState } = await import("@/lib/seed");

    const active = await getJobsByPool("active");
    expect(active.map((job) => job.id).sort()).toEqual(
      getDefaultSeedState()
        .activeJobs.map((job) => job.id)
        .sort()
    );
  });

  it("refuses repository writes", async () => {
    const { deleteJobRecord, updateComments } = await import("@/lib/db/repository");

    await expect(deleteJobRecord("seed-active-1")).rejects.toThrow(/read-only/);
    await expect(updateComments("seed-active-1", "x")).rejects.toThrow(/read-only/);
  });

  it("returns a read-only result from every write action", async () => {
    const {
      archiveJobToRejected,
      createJobFromText,
      deleteJobPermanently,
      updateActiveJobStage,
      updateDailyGoal,
      updateJobComments
    } = await import("@/app/actions");

    const created = await createJobFromText("Data Analyst at Example Corp");
    expect(created).toMatchObject({ status: "blocked" });

    for (const result of await Promise.all([
      updateJobComments("seed-active-1", "note"),
      updateActiveJobStage("seed-active-1", "round_1"),
      archiveJobToRejected("seed-active-1"),
      deleteJobPermanently("seed-active-1"),
      updateDailyGoal({ goal: "connect", kind: "increment" })
    ])) {
      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("read-only") });
    }
  });

  it("still answers read-only email matching against the seed set", async () => {
    const { matchRejectionEmail } = await import("@/app/actions");
    const matches = await matchRejectionEmail("IBM Canada Associate Business Analyst");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("returns 403 with the read-only message from the API routes", async () => {
    const { DELETE } = await import("@/app/api/jobs/[id]/route");
    const { POST: archive } = await import("@/app/api/jobs/[id]/archive/route");
    const { POST: extract } = await import("@/app/api/extract/route");
    const params = Promise.resolve({ id: "seed-active-1" });

    for (const response of [
      await DELETE(new Request("http://localhost/api/jobs/seed-active-1", { method: "DELETE" }), { params }),
      await archive(new Request("http://localhost/api/jobs/seed-active-1/archive", { method: "POST" }), { params }),
      await extract(
        new Request("http://localhost/api/extract", {
          method: "POST",
          body: JSON.stringify({ url: "https://example.com/job" })
        })
      )
    ]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: expect.stringContaining("read-only") });
    }
  });
});
