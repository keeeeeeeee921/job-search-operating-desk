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
delete process.env.JOB_DESK_ACCESS_TOKEN;

describe("search cycle server actions", () => {
  beforeEach(async () => {
    delete process.env.JOB_DESK_ACCESS_TOKEN;
    const { resetDatabaseForTests } = await import("@/lib/db/repository");
    await resetDatabaseForTests();
  });

  afterEach(() => {
    cookieJar.clear();
    delete process.env.JOB_DESK_ACCESS_TOKEN;
    delete process.env.JOB_DESK_PUBLIC_DEMO;
  });

  it("saves a story and the page data reflects it", async () => {
    const { saveSearchCycleStory } = await import("@/app/search-cycle-actions");
    const { getSearchCycles } = await import("@/lib/db/repository");
    const searchTwo = (await getSearchCycles()).find((cycle) => cycle.label === "Search 02");

    const result = await saveSearchCycleStory(searchTwo!.id, {
      title: "Second search",
      goals: "Senior analyst role\nStay in retail analytics",
      note: "Narrower scope.",
      startDate: "2026-04-03",
      endDate: "",
      imageSrc: ""
    });

    expect(result).toMatchObject({
      ok: true,
      cycle: {
        label: "Search 02",
        title: "Second search",
        goals: ["Senior analyst role", "Stay in retail analytics"],
        note: "Narrower scope.",
        endDate: null,
        imageSrc: null
      }
    });

    const stored = (await getSearchCycles()).find((cycle) => cycle.label === "Search 02");
    expect(stored?.title).toBe("Second search");
  });

  it("returns validation errors instead of writing", async () => {
    const { saveSearchCycleStory } = await import("@/app/search-cycle-actions");
    const { getSearchCycles } = await import("@/lib/db/repository");
    const [searchOne] = await getSearchCycles();

    expect(await saveSearchCycleStory(searchOne.id, { startDate: "2026-04-03" })).toEqual({
      ok: false,
      error: expect.stringContaining("Search 02 already starts")
    });
    expect(await saveSearchCycleStory(999, { startDate: "2026-01-01" })).toEqual({
      ok: false,
      error: "Unknown search cycle."
    });
    expect(await saveSearchCycleStory(searchOne.id, { startDate: "nope" })).toEqual({
      ok: false,
      error: expect.stringContaining("YYYY-MM-DD")
    });
  });

  it("starts a new cycle, closes the previous one and routes new records to it", async () => {
    const { startSearchCycle } = await import("@/app/search-cycle-actions");
    const { createJobFromText } = await import("@/app/actions");
    const { getSearchCycles, getJobsPage } = await import("@/lib/db/repository");
    const { getSearchCycleDateKey, previousSearchCycleDateKey } = await import(
      "@/lib/search-cycle"
    );
    const today = getSearchCycleDateKey();

    const started = await startSearchCycle({ label: "Search 03", startDate: today });
    expect(started).toMatchObject({
      ok: true,
      cycle: { label: "Search 03", startDate: today, endDate: null, title: "" }
    });

    const cycles = await getSearchCycles();
    expect(cycles.map((cycle) => cycle.label)).toEqual(["Search 01", "Search 02", "Search 03"]);
    expect(cycles[1]?.endDate).toBe(previousSearchCycleDateKey(today));

    const saved = await createJobFromText(`
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
    expect(saved.status).toBe("saved");
    if (saved.status === "saved") {
      expect(saved.record.searchCycleLabel).toBe("Search 03");
    }

    const current = await getJobsPage({ pool: "active", searchCycle: "current" });
    expect(current.totalCount).toBe(1);
    expect(current.records[0]?.company).toBe("Federal Express Corporation");

    expect(await startSearchCycle({ label: "Search 03", startDate: today })).toEqual({
      ok: false,
      error: expect.stringContaining("already exists")
    });
    expect(await startSearchCycle({ label: "Search 04", startDate: "2026-01-01" })).toEqual({
      ok: false,
      error: expect.stringContaining("must start after Search 03")
    });
  });

  it("refuses without a matching access cookie and in the public demo", async () => {
    process.env.JOB_DESK_ACCESS_TOKEN = "unit-test-token";
    const { saveSearchCycleStory, startSearchCycle } = await import(
      "@/app/search-cycle-actions"
    );

    expect(await saveSearchCycleStory(1, { startDate: "2025-09-06" })).toEqual({
      ok: false,
      error: expect.stringContaining("access token")
    });
    expect(await startSearchCycle({ label: "Search 03", startDate: "2026-10-15" })).toEqual({
      ok: false,
      error: expect.stringContaining("access token")
    });

    cookieJar.set("job_desk_token", "unit-test-token");
    const allowed = await saveSearchCycleStory(1, {
      title: "Edited",
      startDate: "2025-09-06",
      endDate: "2026-04-02"
    });
    expect(allowed.ok).toBe(true);

    process.env.JOB_DESK_PUBLIC_DEMO = "true";
    expect(await saveSearchCycleStory(1, { startDate: "2025-09-06" })).toEqual({
      ok: false,
      error: expect.stringContaining("read-only")
    });
  });
});
