import { describe, expect, it } from "vitest";
import {
  SEARCH_01_LABEL,
  SEARCH_02_LABEL,
  SEARCH_02_START_INSTANT,
  getCurrentSearchCycleLabel,
  isCurrentSearchCycleRecord,
  matchesSearchCycleScope,
  resolveSearchCycleLabel,
  searchLogCycles
} from "@/lib/search-cycle";

describe("search cycle labeling", () => {
  it("resolves Search 01 before the Toronto cutoff and Search 02 on/after it", () => {
    expect(resolveSearchCycleLabel("2026-04-03T03:59:59.000Z")).toBe(
      SEARCH_01_LABEL
    );
    expect(resolveSearchCycleLabel("2026-04-03T04:00:00.000Z")).toBe(
      SEARCH_02_LABEL
    );
  });

  it("keeps Search Log snapshot metadata aligned with Search 01", () => {
    expect(searchLogCycles[0]?.label).toBe(SEARCH_01_LABEL);
    expect(searchLogCycles[0]?.period).toContain("April 2, 2026");
  });

  it("keeps the Search 02 start instant aligned with the Toronto cutoff", () => {
    expect(resolveSearchCycleLabel(SEARCH_02_START_INSTANT)).toBe(SEARCH_02_LABEL);
    expect(
      resolveSearchCycleLabel(new Date(SEARCH_02_START_INSTANT.getTime() - 1))
    ).toBe(SEARCH_01_LABEL);
  });

  it("treats the cycle resolved from today as the current working set", () => {
    const now = new Date("2026-10-13T12:00:00.000Z");
    expect(getCurrentSearchCycleLabel(now)).toBe(SEARCH_02_LABEL);

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

    expect(isCurrentSearchCycleRecord(legacy, now)).toBe(false);
    expect(isCurrentSearchCycleRecord(current, now)).toBe(true);
    expect(isCurrentSearchCycleRecord(unlabeledCurrent, now)).toBe(true);

    expect(matchesSearchCycleScope(legacy, "older", now)).toBe(true);
    expect(matchesSearchCycleScope(legacy, "current", now)).toBe(false);
    expect(matchesSearchCycleScope(legacy, "all", now)).toBe(true);
    expect(matchesSearchCycleScope(current, "older", now)).toBe(false);
  });
});
