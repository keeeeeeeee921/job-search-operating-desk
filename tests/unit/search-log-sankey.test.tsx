import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchLogSankey, layoutFlow } from "@/components/search-log-sankey";
import { buildSearchLogFlow } from "@/lib/search-log-flow";
import type { SearchLogStageBucket } from "@/lib/types";

function bucket(
  pool: SearchLogStageBucket["pool"],
  stage: SearchLogStageBucket["stage"],
  count: number
): SearchLogStageBucket {
  return { searchCycleLabel: "Search 01", pool, stage, count };
}

// Mirrors the real Search 01 shape: thousands applied, a few dozen interviewed.
const search01 = buildSearchLogFlow({
  label: "Search 01",
  buckets: [
    bucket("active", "no_response", 1421),
    bucket("rejected", "rejected", 4091),
    bucket("rejected", "screening_oa", 20),
    bucket("active", "unpaid", 1),
    bucket("rejected", "round_1", 9),
    bucket("rejected", "round_2", 3),
    bucket("active", "offer", 1)
  ]
});

const search02 = buildSearchLogFlow({
  label: "Search 02",
  buckets: [bucket("active", "no_response", 3), bucket("rejected", "rejected", 50)]
});

function labelGroup(id: string) {
  return document.querySelector(`[data-node-label="${id}"]`);
}

describe("layoutFlow", () => {
  it("keeps every column inside the chart in both states", () => {
    for (const focus of [false, true]) {
      const frame = layoutFlow(search01, focus);
      for (const node of search01.nodes) {
        const { y, h } = frame.nodes[node.id];
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + h).toBeLessThanOrEqual(300);
      }
    }
  });

  it("draws the interviewed subset as a hairline in the overview and full height in focus", () => {
    const overview = layoutFlow(search01, false);
    const focus = layoutFlow(search01, true);

    expect(overview.nodes.screening.h).toBeLessThan(5);
    expect(overview.nodes.rejected.h).toBeGreaterThan(150);
    expect(overview.nodes.round_1.show).toBe(false);

    expect(focus.nodes.screening.h).toBeGreaterThan(200);
    expect(focus.nodes.round_1.show).toBe(true);
    expect(focus.nodes.offer.show).toBe(true);
    // Context bands collapse to 2px stubs at the bottom edge.
    expect(focus.nodes.rejected.h).toBe(2);
    expect(focus.nodes.no_response.h).toBe(2);
    expect(focus.nodes.no_response.y).toBe(298);
    expect(focus.nodes.rejected.show).toBe(false);
  });

  it("never lets a column's labels collide", () => {
    for (const focus of [false, true]) {
      const frame = layoutFlow(search01, focus);
      for (const column of [1, 2, 3, 4]) {
        const shown = search01.nodes
          .filter((node) => node.column === column && frame.nodes[node.id].show)
          .map((node) => frame.nodes[node.id].y)
          .sort((a, b) => a - b);
        for (let index = 1; index < shown.length; index += 1) {
          expect(shown[index] - shown[index - 1]).toBeGreaterThanOrEqual(26);
        }
      }
    }
  });
});

describe("SearchLogSankey", () => {
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

  it("toggles between All and Interviewed from the buttons", async () => {
    const user = userEvent.setup();
    render(<SearchLogSankey flow={search01} />);

    const all = screen.getByRole("button", { name: "All 5,546" });
    const interviewed = screen.getByRole("button", { name: "Interviewed 34" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(interviewed).toHaveAttribute("aria-pressed", "false");
    expect(labelGroup("round_1")).toBeNull();
    expect(screen.getByText("click to focus on these 34")).toHaveAttribute("opacity", "1");

    await user.click(interviewed);

    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(interviewed).toHaveAttribute("aria-pressed", "true");
    expect(labelGroup("round_1")).not.toBeNull();
    expect(within(labelGroup("round_1") as HTMLElement).getByText("Round 1")).toBeInTheDocument();
    // Percentages switch to the interviewed denominator.
    expect(within(labelGroup("round_1") as HTMLElement).getByText("38.2%")).toBeInTheDocument();
    expect(screen.getByText("click to focus on these 34")).toHaveAttribute("opacity", "0");

    await user.click(all);
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(labelGroup("round_1")).toBeNull();
  });

  it("focuses from the Screening node by mouse and keyboard", async () => {
    const user = userEvent.setup();
    render(<SearchLogSankey flow={search01} />);

    const screening = screen.getByRole("button", { name: /Screening \/ OA: 34\. Focus on these/ });
    expect(screening).toHaveAttribute("tabindex", "0");

    await user.click(screening);
    expect(screen.getByRole("button", { name: "Interviewed 34" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    screening.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "All 5,546" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Interviewed 34" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("adds hover titles to bands and nodes", () => {
    render(<SearchLogSankey flow={search01} />);
    const titles = Array.from(document.querySelectorAll("svg title")).map(
      (title) => title.textContent
    );

    expect(titles).toContain("Applied → Screening / OA: 34 (0.6% of applied)");
    expect(titles).toContain("Screening / OA: 34 · click to focus");
    expect(titles).toContain("Round 2+ → Offer: 1 (0% of applied)");
  });

  it("disables Interviewed when nobody reached an interview", () => {
    render(<SearchLogSankey flow={search02} />);

    const interviewed = screen.getByRole("button", { name: "Interviewed 0" });
    expect(interviewed).toBeDisabled();
    expect(interviewed).toHaveAttribute("title", "No interview stages recorded yet");
    expect(screen.queryByText(/click to focus/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Screening \/ OA/ })).toBeNull();
  });
});
