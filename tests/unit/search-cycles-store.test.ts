import { beforeEach, describe, expect, it } from "vitest";
import {
  createSearchCycle,
  getSearchCycles,
  resetDatabaseForTests,
  updateSearchCycle
} from "@/lib/db/repository";
import { initialSearchCycles } from "@/lib/search-cycle";

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";

describe("search cycles store", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("boots with the same two cycles migration 0009 inserts", async () => {
    const cycles = await getSearchCycles();

    expect(cycles.map((cycle) => cycle.label)).toEqual(
      initialSearchCycles.map((cycle) => cycle.label)
    );
    expect(cycles[0]).toMatchObject({
      label: "Search 01",
      startDate: "2025-09-06",
      endDate: "2026-04-02",
      title: "First full-time search after graduation",
      goals: ["Find a job", "Keep some data analysis content in the role"],
      imageSrc: "/job-search-cycle-01.png"
    });
    expect(cycles[1]).toMatchObject({
      label: "Search 02",
      startDate: "2026-04-03",
      endDate: null,
      title: "",
      goals: [],
      note: "",
      imageSrc: null
    });
    expect(cycles.every((cycle) => typeof cycle.id === "number")).toBe(true);
  });

  it("creates a cycle, rejects duplicate labels and keeps start-date order", async () => {
    const created = await createSearchCycle({
      label: "Search 03",
      startDate: "2026-11-01",
      endDate: null,
      title: "",
      goals: [],
      note: "",
      imageSrc: null
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.createdAt).toBe(created.updatedAt);

    await expect(
      createSearchCycle({
        label: "Search 03",
        startDate: "2027-01-01",
        endDate: null,
        title: "",
        goals: [],
        note: "",
        imageSrc: null
      })
    ).rejects.toThrow(/already exists/);

    const labels = (await getSearchCycles()).map((cycle) => cycle.label);
    expect(labels).toEqual(["Search 01", "Search 02", "Search 03"]);
  });

  it("updates only the fields in the patch and bumps updatedAt", async () => {
    const [, searchTwo] = await getSearchCycles();
    const before = new Date("2026-10-15T12:00:00.000Z");

    const updated = await updateSearchCycle(searchTwo.id, {
      title: "Second search",
      goals: ["Senior analyst role"],
      endDate: "2026-12-31"
    });

    expect(updated).toMatchObject({
      id: searchTwo.id,
      label: "Search 02",
      startDate: "2026-04-03",
      endDate: "2026-12-31",
      title: "Second search",
      goals: ["Senior analyst role"],
      note: ""
    });
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(before.getTime());

    const persisted = (await getSearchCycles()).find((cycle) => cycle.id === searchTwo.id);
    expect(persisted?.title).toBe("Second search");

    await expect(updateSearchCycle(999, { title: "x" })).rejects.toThrow(/does not exist/);
  });
});

describe("migration 0009", () => {
  it("inserts the same cycles the local store seeds", async () => {
    const { readFile } = await import("node:fs/promises");
    const sql = await readFile("drizzle/0009_search_cycles.sql", "utf8");

    expect(sql).toContain('CREATE TABLE "search_cycles"');
    for (const cycle of initialSearchCycles) {
      expect(sql).toContain(`'${cycle.label}'`);
      expect(sql).toContain(`'${cycle.startDate}'`);
      if (cycle.title) {
        expect(sql).toContain(`'${cycle.title}'`);
      }
    }
    expect(sql).toContain('ON CONFLICT ("label") DO NOTHING');
  });
});
