import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchLogPage } from "@/components/search-log-page";
import type { SearchLogAnalytics } from "@/lib/types";

const analytics: SearchLogAnalytics = {
  cycles: [
    {
      label: "Search 01",
      total: 12,
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
    render(<SearchLogPage analytics={analytics} />);

    const row01 = screen.getByRole("region", { name: "Search 01" });
    const row02 = screen.getByRole("region", { name: "Search 02" });

    expect(within(row01).getByText(/Sep 6, 2025 to April 2, 2026/)).toBeInTheDocument();
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
    expect(screen.queryByText(/No saved story/)).not.toBeInTheDocument();

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
      />
    );

    expect(screen.getByText("No flow data yet")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
