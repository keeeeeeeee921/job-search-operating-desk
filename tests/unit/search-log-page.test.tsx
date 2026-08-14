import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
          count: 12
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
  it("keeps the selected flow and saved story aligned", async () => {
    const user = userEvent.setup();
    render(<SearchLogPage analytics={analytics} />);

    expect(screen.getByRole("button", { name: "Search 02" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("heading", { name: "No saved story for Search 02" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Search 01" }));

    expect(screen.getByRole("button", { name: "Search 01" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("heading", {
        name: "Search 01: First full-time search after graduation"
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("No saved story for Search 02")).not.toBeInTheDocument();
  });
});
