import { describe, expect, it } from "vitest";
import { initialSearchCycles } from "@/lib/search-cycle";
import {
  goalsToText,
  parseGoalsText,
  parseNewSearchCycleForm,
  parseSearchCycleStoryForm,
  suggestNextSearchCycleLabel,
  validateNewSearchCycleAgainst,
  validateSearchCycleStoryAgainst
} from "@/lib/search-cycle-form";
import type { SearchCycle } from "@/lib/types";

const cycles: SearchCycle[] = initialSearchCycles.map((cycle, index) => ({
  ...cycle,
  goals: [...cycle.goals],
  id: index + 1,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z"
}));

describe("parseSearchCycleStoryForm", () => {
  it("trims fields, splits goals by line and turns empty optionals into null", () => {
    const result = parseSearchCycleStoryForm({
      title: "  Second search  ",
      goals: "- Senior analyst role\r\n\n  Stay in retail analytics \n",
      note: "  Narrow scope.\r\nFewer applications.  ",
      startDate: "2026-04-03",
      endDate: "",
      imageSrc: "   "
    });

    expect(result).toEqual({
      ok: true,
      value: {
        title: "Second search",
        goals: ["Senior analyst role", "Stay in retail analytics"],
        note: "Narrow scope.\nFewer applications.",
        startDate: "2026-04-03",
        endDate: null,
        imageSrc: null
      }
    });
  });

  it("accepts a public/ path or an https URL as the image", () => {
    const local = parseSearchCycleStoryForm({ startDate: "2026-04-03", imageSrc: "/cycle-02.png" });
    expect(local.ok && local.value.imageSrc).toBe("/cycle-02.png");
    const remote = parseSearchCycleStoryForm({ startDate: "2026-04-03", imageSrc: "https://example.com/a.png" });
    expect(remote.ok && remote.value.imageSrc).toBe("https://example.com/a.png");
  });

  it.each([
    [{ startDate: "" }, /Start date is required/],
    [{ startDate: "2026-13-01" }, /YYYY-MM-DD/],
    [{ startDate: "2026-04-03", endDate: "2026-04-02" }, /on or after the start date/],
    [{ startDate: "2026-04-03", endDate: "soon" }, /End date must be a date/],
    [{ startDate: "2026-04-03", imageSrc: "cycle.png" }, /must start with \//],
    [{ startDate: "2026-04-03", imageSrc: "//evil.example/x.png" }, /must not start with \/\//],
    [{ startDate: "2026-04-03", title: "x".repeat(201) }, /at most 200/],
    [{ startDate: "2026-04-03", note: "x".repeat(4001) }, /at most 4000/],
    [{ startDate: "2026-04-03", goals: Array.from({ length: 21 }, (_, i) => `g${i}`).join("\n") }, /20 goals/],
    [{ startDate: "2026-04-03", goals: "y".repeat(201) }, /Each goal/]
  ])("rejects %j", (values, message) => {
    const result = parseSearchCycleStoryForm(values);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });

  it("round-trips goals through the textarea text", () => {
    expect(parseGoalsText(goalsToText(["a", "b"]))).toEqual(["a", "b"]);
  });
});

describe("validateSearchCycleStoryAgainst", () => {
  it("lets a cycle keep its own start date but not take another cycle's", () => {
    const value = { title: "", goals: [], note: "", startDate: "2026-04-03", endDate: null, imageSrc: null };
    expect(validateSearchCycleStoryAgainst(value, 2, cycles)).toBeNull();
    expect(validateSearchCycleStoryAgainst(value, 1, cycles)).toMatch(/Search 02 already starts/);
    expect(
      validateSearchCycleStoryAgainst({ ...value, startDate: "2026-05-01" }, 1, cycles)
    ).toBeNull();
  });
});

describe("parseNewSearchCycleForm / validateNewSearchCycleAgainst", () => {
  it("requires a label and a valid start date", () => {
    expect(parseNewSearchCycleForm({ label: "", startDate: "2026-10-15" })).toEqual({
      ok: false,
      error: "Label is required."
    });
    expect(parseNewSearchCycleForm({ label: "x".repeat(33), startDate: "2026-10-15" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("at most 32")
    });
    expect(parseNewSearchCycleForm({ label: "Search 03", startDate: "" })).toEqual({
      ok: false,
      error: "Start date is required."
    });
    expect(parseNewSearchCycleForm({ label: "  Search   03 ", startDate: "2026-10-15" })).toEqual({
      ok: true,
      value: { label: "Search 03", startDate: "2026-10-15" }
    });
  });

  it("rejects duplicate labels, starts not after the latest cycle, and future starts", () => {
    const today = "2026-10-15";
    expect(
      validateNewSearchCycleAgainst({ label: "search 02", startDate: "2026-10-01" }, cycles, today)
    ).toMatch(/already exists/);
    expect(
      validateNewSearchCycleAgainst({ label: "Search 03", startDate: "2026-04-03" }, cycles, today)
    ).toMatch(/must start after Search 02/);
    expect(
      validateNewSearchCycleAgainst({ label: "Search 03", startDate: "2026-10-16" }, cycles, today)
    ).toMatch(/cannot be in the future/);
    expect(
      validateNewSearchCycleAgainst({ label: "Search 03", startDate: today }, cycles, today)
    ).toBeNull();
    expect(validateNewSearchCycleAgainst({ label: "First", startDate: today }, [], today)).toBeNull();
  });

  it("suggests the next label from the latest cycle", () => {
    expect(suggestNextSearchCycleLabel(cycles)).toBe("Search 03");
    expect(suggestNextSearchCycleLabel([{ label: "Search 9", startDate: "2026-01-01" }])).toBe("Search 10");
    expect(suggestNextSearchCycleLabel([{ label: "Spring", startDate: "2026-01-01" }])).toBe("Search 02");
    expect(suggestNextSearchCycleLabel([])).toBe("Search 01");
  });
});
