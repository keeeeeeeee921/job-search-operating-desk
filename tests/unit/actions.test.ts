import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";

describe("server actions", () => {
  beforeEach(async () => {
    const { resetDatabaseForTests } = await import("@/lib/db/repository");
    await resetDatabaseForTests();
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
      "http://localhost:3000/mock-jobs/tiktok-data-analyst-duplicate"
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
});
