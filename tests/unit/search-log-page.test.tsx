import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchLogPage } from "@/components/search-log-page";
import type { SearchCycle, SearchLogAnalytics } from "@/lib/types";

const cycles: SearchCycle[] = [
  {
    id: 1,
    label: "Search 01",
    startDate: "2025-09-06",
    endDate: "2026-04-02",
    title: "First full-time search after graduation",
    goals: ["Find a job", "Keep some data analysis content in the role"],
    note: "Broad scope, honest notes.",
    imageSrc: "/job-search-cycle-01.png",
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z"
  },
  {
    id: 2,
    label: "Search 02",
    startDate: "2026-04-03",
    endDate: null,
    title: "",
    goals: [],
    note: "",
    imageSrc: null,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z"
  }
];

const analytics: SearchLogAnalytics = {
  cycles: [
    {
      label: "Search 01",
      total: 12,
      interviewedCompanies: [
        { company: "ZURU Toys", stage: "offer" },
        { company: "Axon", stage: "round_1" },
        { company: "Tencent", stage: "round_1" }
      ],
      buckets: [
        {
          searchCycleLabel: "Search 01",
          pool: "active",
          stage: "no_response",
          count: 8
        },
        {
          searchCycleLabel: "Search 01",
          pool: "rejected",
          stage: "round_1",
          count: 3
        },
        {
          searchCycleLabel: "Search 01",
          pool: "active",
          stage: "offer",
          count: 1
        }
      ]
    },
    {
      label: "Search 02",
      total: 8,
      interviewedCompanies: [],
      buckets: [
        {
          searchCycleLabel: "Search 02",
          pool: "rejected",
          stage: "rejected",
          count: 8
        }
      ]
    }
  ],
  sunkenActiveCount: 4,
  sunkenThresholdDate: "2025-11-13T00:00:00.000Z",
  sunkenMonths: 9
};

describe("SearchLogPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows every cycle as its own row with the saved story below", async () => {
    const user = userEvent.setup();
    render(<SearchLogPage analytics={analytics} cycles={cycles} />);

    const row01 = screen.getByRole("region", { name: "Search 01" });
    const row02 = screen.getByRole("region", { name: "Search 02" });

    expect(within(row01).getByText(/Sep 6, 2025 to Apr 2, 2026/)).toBeInTheDocument();
    expect(within(row02).getByText(/Since Apr 3, 2026/)).toBeInTheDocument();
    expect(within(row01).getByText(/12 applications/)).toBeInTheDocument();
    expect(within(row01).getByText(/4 reached Screening \/ OA/)).toBeInTheDocument();
    expect(within(row02).getByText(/8 applications/)).toBeInTheDocument();
    expect(within(row02).getByText(/0 reached Screening \/ OA/)).toBeInTheDocument();

    expect(screen.getByText("Applications in Search 01")).toBeInTheDocument();
    expect(screen.getByText("Applications in Search 02")).toBeInTheDocument();
    expect(screen.getByText("Legacy active records")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Search 01: First full-time search after graduation"
      })
    ).toBeInTheDocument();

    // Saved stories come from the cycle rows; the company list from the records.
    const story01 = screen.getByTestId("search-cycle-story-search-01");
    expect(within(story01).getByText("Find a job")).toBeInTheDocument();
    expect(within(story01).getByText("Broad scope, honest notes.")).toBeInTheDocument();
    const companies01 = within(story01).getAllByRole("listitem").map((item) =>
      item.textContent?.replace(/\s+/g, " ").trim()
    );
    expect(companies01).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ZURU Toys.*Offer$/),
        expect.stringMatching(/^Axon.*Round 1$/),
        expect.stringMatching(/^Tencent.*Round 1$/)
      ])
    );

    const story02 = screen.getByTestId("search-cycle-story-search-02");
    expect(within(story02).getByRole("heading", { name: "Search 02" })).toBeInTheDocument();
    expect(
      within(story02).getByText("No story written for Search 02 yet")
    ).toBeInTheDocument();
    expect(
      within(story02).getByText(/No application in this cycle has reached/)
    ).toBeInTheDocument();
    expect(within(story02).queryByRole("img")).not.toBeInTheDocument();

    // Each row has its own All / Interviewed toggle.
    const interviewed01 = within(row01).getByRole("button", { name: "Interviewed 4" });
    const interviewed02 = within(row02).getByRole("button", { name: "Interviewed 0" });
    expect(interviewed02).toBeDisabled();

    await user.click(interviewed01);
    expect(interviewed01).toHaveAttribute("aria-pressed", "true");
    expect(within(row01).getByRole("button", { name: "All 12" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(within(row02).getByRole("button", { name: "All 8" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("falls back to an empty state when no cycle has records", () => {
    render(
      <SearchLogPage
        analytics={{ ...analytics, cycles: [] }}
        cycles={cycles}
      />
    );

    expect(screen.getByText("No flow data yet")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    // The stories still render for every defined cycle.
    expect(screen.getByTestId("search-cycle-story-search-01")).toBeInTheDocument();
    expect(screen.getByTestId("search-cycle-story-search-02")).toBeInTheDocument();
  });
});
