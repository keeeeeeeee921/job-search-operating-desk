import { describe, expect, it } from "vitest";
import {
  SEARCH_01_LABEL,
  SEARCH_02_LABEL,
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
});
