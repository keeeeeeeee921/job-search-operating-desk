import { describe, expect, it } from "vitest";
import { initialSearchCycles } from "@/lib/search-cycle";
import {
  buildInterviewedCompanies,
  buildSearchLogAnalyticsFromRows,
  type SearchLogAnalyticsRow
} from "@/lib/search-log-analytics";

function row(overrides: Partial<SearchLogAnalyticsRow>): SearchLogAnalyticsRow {
  return {
    timestamp: "2026-01-10T12:00:00.000Z",
    pool: "active",
    stage: "no_response",
    searchCycleLabel: "Search 01",
    company: "Company",
    ...overrides
  };
}

describe("buildInterviewedCompanies", () => {
  it("lists companies past no_response / rejected once, furthest stage first, then by name", () => {
    const result = buildInterviewedCompanies([
      row({ company: "Axon", stage: "round_1" }),
      row({ company: "ZURU Toys", stage: "screening_oa", pool: "rejected" }),
      row({ company: "ZURU Toys", stage: "offer" }),
      row({ company: "Nomura", stage: "no_response" }),
      row({ company: "Valon", stage: "rejected", pool: "rejected" }),
      row({ company: "Tencent", stage: "round_1", pool: "rejected" }),
      row({ company: "CarMax", stage: "unpaid" }),
      row({ company: "  ", stage: "offer" })
    ]);

    expect(result).toEqual([
      { company: "ZURU Toys", stage: "offer" },
      { company: "Axon", stage: "round_1" },
      { company: "Tencent", stage: "round_1" },
      { company: "CarMax", stage: "unpaid" }
    ]);
  });

  it("merges company names that differ only by case or spacing", () => {
    const result = buildInterviewedCompanies([
      row({ company: "ibm canada", stage: "screening_oa" }),
      row({ company: "IBM  Canada", stage: "round_2" })
    ]);

    expect(result).toEqual([{ company: "IBM  Canada", stage: "round_2" }]);
  });

  it("returns an empty list when nothing reached an interview", () => {
    expect(
      buildInterviewedCompanies([row({ stage: "no_response" }), row({ stage: "rejected" })])
    ).toEqual([]);
  });
});

describe("buildSearchLogAnalyticsFromRows", () => {
  it("resolves null labels from the cycle list and attaches interviewed companies per cycle", () => {
    const analytics = buildSearchLogAnalyticsFromRows(
      [
        row({ searchCycleLabel: null, timestamp: "2026-04-03T03:59:59.000Z", company: "Old Co", stage: "round_1" }),
        row({ searchCycleLabel: null, timestamp: "2026-04-03T04:00:00.000Z", company: "New Co", stage: "offer" }),
        row({ searchCycleLabel: "Search 02", company: "Quiet Co" })
      ],
      9,
      initialSearchCycles
    );

    expect(analytics.cycles.map((cycle) => cycle.label)).toEqual(["Search 01", "Search 02"]);
    expect(analytics.cycles[0]?.interviewedCompanies).toEqual([
      { company: "Old Co", stage: "round_1" }
    ]);
    expect(analytics.cycles[1]?.total).toBe(2);
    expect(analytics.cycles[1]?.interviewedCompanies).toEqual([
      { company: "New Co", stage: "offer" }
    ]);
  });

  it("orders cycles by start date and puts labels unknown to the table last", () => {
    const cycles = [
      { label: "Spring 2027", startDate: "2027-03-01" },
      ...initialSearchCycles
    ];
    const analytics = buildSearchLogAnalyticsFromRows(
      [
        row({ searchCycleLabel: "Spring 2027" }),
        row({ searchCycleLabel: "Search 02" }),
        row({ searchCycleLabel: "Search 09" }),
        row({ searchCycleLabel: "Search 01" })
      ],
      9,
      cycles
    );

    expect(analytics.cycles.map((cycle) => cycle.label)).toEqual([
      "Search 01",
      "Search 02",
      "Spring 2027",
      "Search 09"
    ]);
  });
});
