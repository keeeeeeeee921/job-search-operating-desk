import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined
  })
}));

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";
// CI exports JOB_DESK_ACCESS_TOKEN for the e2e server; these tests set it
// explicitly where they need it, so start every test without one.
delete process.env.JOB_DESK_ACCESS_TOKEN;

describe("server actions", () => {
  beforeEach(async () => {
    delete process.env.JOB_DESK_ACCESS_TOKEN;
    const { resetDatabaseForTests } = await import("@/lib/db/repository");
    await resetDatabaseForTests();
  });

  afterEach(() => {
    cookieJar.clear();
    delete process.env.JOB_DESK_ACCESS_TOKEN;
  });

  it("saves a fully extracted record", async () => {
    const { createJobFromLink } = await import("@/app/actions");
    const result = await createJobFromLink(
      "http://localhost:3000/mock-jobs/aurora-data-analyst"
    );

    expect(result.status).toBe("saved");
    if (result.status === "saved") {
      expect(result.record.company).toBe("Aurora Labs");
    }
  });

  it("returns review for restricted linkedin links", async () => {
    const { createJobFromLink } = await import("@/app/actions");
    const result = await createJobFromLink(
      "https://www.linkedin.com/jobs/view/data-science-intern-summer-2026-at-fedex-4256789012"
    );

    expect(result.status).toBe("review");
    if (result.status === "review") {
      expect(result.draft.roleTitle).toBe("Data Science Intern Summer 2026");
      expect(result.draft.company).toBe("FedEx");
    }
  });

  it("returns duplicate candidates when the record matches an existing seed", async () => {
    const { createJobFromLink } = await import("@/app/actions");
    const result = await createJobFromLink(
      "http://localhost:3000/mock-jobs/ibm-canada-associate-business-analyst-duplicate"
    );

    expect(result.status).toBe("duplicate");
  });

  it("saves a pasted job text record without a link", async () => {
    const { createJobFromText } = await import("@/app/actions");
    const result = await createJobFromText(`
Req ID: P25-321635-2
Data Science Intern (Summer 2026)
Student Programs
Company: Federal Express Corporation
Location:
Remote
Description
As a FedEx Intern, you will be working on projects gaining valuable, real-world experience in a professional environment.
Preferred Qualifications
Python
    `);

    expect(result.status).toBe("saved");
    if (result.status === "saved") {
      expect(result.record.company).toBe("Federal Express Corporation");
      expect(result.record.link).toBe("");
    }
  });

  it("refuses writes without a matching access cookie when a token is configured", async () => {
    process.env.JOB_DESK_ACCESS_TOKEN = "unit-test-token";
    const { createJobFromText, updateActiveJobStage, updateDailyGoal } = await import(
      "@/app/actions"
    );

    const created = await createJobFromText("Data Analyst at Example Corp");
    expect(created.status).toBe("blocked");

    const staged = await updateActiveJobStage("seed-active-1", "round_1");
    expect(staged).toEqual({ ok: false, error: expect.stringContaining("access token") });

    const goal = await updateDailyGoal({ goal: "connect", kind: "increment" });
    expect(goal.ok).toBe(false);
  });

  it("accepts writes when the access cookie matches the configured token", async () => {
    process.env.JOB_DESK_ACCESS_TOKEN = "unit-test-token";
    cookieJar.set("job_desk_token", "unit-test-token");
    const { updateActiveJobStage } = await import("@/app/actions");

    const staged = await updateActiveJobStage("seed-active-1", "round_1");
    expect(staged).toEqual({ ok: true });
  });
});
