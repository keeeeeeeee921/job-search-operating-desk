import { describe, expect, it } from "vitest";
import {
  SEARCH_01_LABEL,
  SEARCH_02_LABEL,
  UNASSIGNED_SEARCH_CYCLE_LABEL,
  formatSearchCyclePeriod,
  getCurrentSearchCycle,
  getCurrentSearchCycleLabel,
  getSearchCycleStartInstant,
  initialSearchCycles,
  isCurrentSearchCycleRecord,
  isSearchCycleDateKey,
  matchesSearchCycleScope,
  previousSearchCycleDateKey,
  resolveSearchCycleLabel,
  sortSearchCyclesByStart
} from "@/lib/search-cycle";

const cycles = initialSearchCycles;

describe("search cycle resolution", () => {
  it("assigns a record saved on the start day (Toronto) to the new cycle", () => {
    // Search 02 starts 2026-04-03; midnight EDT is 04:00Z.
    expect(resolveSearchCycleLabel("2026-04-03T04:00:00.000Z", cycles)).toBe(
      SEARCH_02_LABEL
    );
    expect(resolveSearchCycleLabel("2026-04-03T23:59:00.000Z", cycles)).toBe(
      SEARCH_02_LABEL
    );
  });

  it("keeps a record saved the day before in the previous cycle", () => {
    expect(resolveSearchCycleLabel("2026-04-03T03:59:59.000Z", cycles)).toBe(
      SEARCH_01_LABEL
    );
    expect(resolveSearchCycleLabel("2026-04-02T12:00:00.000Z", cycles)).toBe(
      SEARCH_01_LABEL
    );
  });

  it("counts anything before the earliest cycle in that earliest cycle", () => {
    expect(resolveSearchCycleLabel("2024-01-01T12:00:00.000Z", cycles)).toBe(
      SEARCH_01_LABEL
    );
  });

  it("picks the latest start date on or before the record among many cycles", () => {
    const three = [
      ...cycles,
      { label: "Search 03", startDate: "2026-11-01" }
    ];
    expect(resolveSearchCycleLabel("2026-10-31T12:00:00.000Z", three)).toBe(
      SEARCH_02_LABEL
    );
    expect(resolveSearchCycleLabel("2026-11-01T05:00:00.000Z", three)).toBe(
      "Search 03"
    );
    expect(resolveSearchCycleLabel(new Date("2027-06-01T12:00:00.000Z"), three)).toBe(
      "Search 03"
    );
  });

  it("does not depend on the order the cycles are listed in", () => {
    const reversed = [...cycles].reverse();
    expect(resolveSearchCycleLabel("2026-01-10T12:00:00.000Z", reversed)).toBe(
      SEARCH_01_LABEL
    );
    expect(getCurrentSearchCycleLabel(reversed)).toBe(SEARCH_02_LABEL);
    expect(sortSearchCyclesByStart(reversed).map((cycle) => cycle.label)).toEqual([
      SEARCH_01_LABEL,
      SEARCH_02_LABEL
    ]);
  });

  it("falls back to an unassigned label when no cycle exists", () => {
    expect(resolveSearchCycleLabel("2026-01-10T12:00:00.000Z", [])).toBe(
      UNASSIGNED_SEARCH_CYCLE_LABEL
    );
    expect(getCurrentSearchCycle([])).toBeNull();
    expect(getCurrentSearchCycleLabel([])).toBe(UNASSIGNED_SEARCH_CYCLE_LABEL);
  });
});

describe("current search cycle", () => {
  it("is the cycle with the latest start date, whatever today's date is", () => {
    expect(getCurrentSearchCycle(cycles)?.label).toBe(SEARCH_02_LABEL);
    expect(
      getCurrentSearchCycle([
        ...cycles,
        { label: "Search 03", startDate: "2027-01-01" }
      ])?.label
    ).toBe("Search 03");
  });

  it("treats the current cycle as the working set and everything else as older", () => {
    const legacy = {
      searchCycleLabel: SEARCH_01_LABEL,
      timestamp: "2026-01-10T12:00:00.000Z"
    };
    const current = {
      searchCycleLabel: SEARCH_02_LABEL,
      timestamp: "2026-10-01T12:00:00.000Z"
    };
    const unlabeledCurrent = {
      searchCycleLabel: null,
      timestamp: "2026-05-01T12:00:00.000Z"
    };
    const unlabeledLegacy = {
      searchCycleLabel: null,
      timestamp: "2026-04-03T03:59:59.000Z"
    };

    expect(isCurrentSearchCycleRecord(legacy, cycles)).toBe(false);
    expect(isCurrentSearchCycleRecord(current, cycles)).toBe(true);
    expect(isCurrentSearchCycleRecord(unlabeledCurrent, cycles)).toBe(true);
    expect(isCurrentSearchCycleRecord(unlabeledLegacy, cycles)).toBe(false);

    expect(matchesSearchCycleScope(legacy, "older", cycles)).toBe(true);
    expect(matchesSearchCycleScope(legacy, "current", cycles)).toBe(false);
    expect(matchesSearchCycleScope(legacy, "all", cycles)).toBe(true);
    expect(matchesSearchCycleScope(current, "older", cycles)).toBe(false);
  });

  it("moves the working set when a later cycle is added", () => {
    const three = [...cycles, { label: "Search 03", startDate: "2026-11-01" }];
    const searchTwoRecord = {
      searchCycleLabel: SEARCH_02_LABEL,
      timestamp: "2026-10-01T12:00:00.000Z"
    };
    expect(isCurrentSearchCycleRecord(searchTwoRecord, three)).toBe(false);
    expect(
      isCurrentSearchCycleRecord(
        { searchCycleLabel: null, timestamp: "2026-11-02T12:00:00.000Z" },
        three
      )
    ).toBe(true);
  });
});

describe("date helpers", () => {
  it("turns a start date into Toronto midnight as a UTC instant, across DST", () => {
    expect(getSearchCycleStartInstant("2026-04-03").toISOString()).toBe(
      "2026-04-03T04:00:00.000Z"
    );
    expect(getSearchCycleStartInstant("2025-09-06").toISOString()).toBe(
      "2025-09-06T04:00:00.000Z"
    );
    expect(getSearchCycleStartInstant("2026-01-15").toISOString()).toBe(
      "2026-01-15T05:00:00.000Z"
    );
    // DST starts 2026-03-08 in Toronto.
    expect(getSearchCycleStartInstant("2026-03-08").toISOString()).toBe(
      "2026-03-08T05:00:00.000Z"
    );
    expect(getSearchCycleStartInstant("2026-03-09").toISOString()).toBe(
      "2026-03-09T04:00:00.000Z"
    );
  });

  it("formats a period from the stored date keys", () => {
    expect(formatSearchCyclePeriod(cycles[0])).toBe("Sep 6, 2025 to Apr 2, 2026");
    expect(formatSearchCyclePeriod(cycles[1])).toBe("Since Apr 3, 2026");
  });

  it("validates date keys and finds the day before", () => {
    expect(isSearchCycleDateKey("2026-04-03")).toBe(true);
    expect(isSearchCycleDateKey("2026-02-29")).toBe(false);
    expect(isSearchCycleDateKey("2026-4-3")).toBe(false);
    expect(isSearchCycleDateKey("not a date")).toBe(false);
    expect(previousSearchCycleDateKey("2026-04-03")).toBe("2026-04-02");
    expect(previousSearchCycleDateKey("2026-03-01")).toBe("2026-02-28");
    expect(previousSearchCycleDateKey("2026-01-01")).toBe("2025-12-31");
  });
});
