import { describe, expect, it } from "vitest";
import {
  buildSearchLogFlow,
  countSearchLogFlow,
  percentOf,
  type SearchLogFlowNodeId
} from "@/lib/search-log-flow";
import type { JobPool, JobStage, SearchLogStageBucket } from "@/lib/types";

function bucket(
  pool: JobPool,
  stage: JobStage,
  count: number,
  searchCycleLabel = "Search 01"
): SearchLogStageBucket {
  return { searchCycleLabel, pool, stage, count };
}

function nodeValue(flow: ReturnType<typeof buildSearchLogFlow>, id: SearchLogFlowNodeId) {
  return flow.nodes.find((node) => node.id === id)?.value;
}

function linkValue(
  flow: ReturnType<typeof buildSearchLogFlow>,
  source: SearchLogFlowNodeId,
  target: SearchLogFlowNodeId
) {
  return flow.links.find((link) => link.source === source && link.target === target)?.value;
}

describe("countSearchLogFlow", () => {
  it("counts a record at round_2 in Screening, Round 1 and Round 2+", () => {
    const counts = countSearchLogFlow([bucket("active", "round_2", 1)]);

    expect(counts).toMatchObject({
      applied: 1,
      screening: 1,
      round1: 1,
      round2Plus: 1,
      offer: 0,
      droppedAtScreening: 0,
      droppedAtRound1: 0,
      droppedAtRound2Plus: 0
    });
  });

  it("treats unpaid as the Screening / OA level and merges round_2..round_5 into Round 2+", () => {
    const counts = countSearchLogFlow([
      bucket("active", "unpaid", 2),
      bucket("active", "round_3", 1),
      bucket("active", "round_5", 1)
    ]);

    expect(counts.screening).toBe(4);
    expect(counts.round1).toBe(2);
    expect(counts.round2Plus).toBe(2);
    expect(counts.offer).toBe(0);
  });

  it("sends rejected records to Dropped right after their furthest column", () => {
    const counts = countSearchLogFlow([
      bucket("rejected", "screening_oa", 3),
      bucket("rejected", "round_1", 2),
      bucket("rejected", "round_4", 1)
    ]);

    expect(counts.droppedAtScreening).toBe(3);
    expect(counts.droppedAtRound1).toBe(2);
    expect(counts.droppedAtRound2Plus).toBe(1);
  });

  it("keeps active records at their furthest column with no Dropped flow", () => {
    const counts = countSearchLogFlow([
      bucket("active", "screening_oa", 3),
      bucket("active", "round_1", 2),
      bucket("active", "offer", 1)
    ]);

    expect(counts.droppedAtScreening).toBe(0);
    expect(counts.droppedAtRound1).toBe(0);
    expect(counts.droppedAtRound2Plus).toBe(0);
    expect(counts.screening).toBe(6);
    expect(counts.round1).toBe(3);
    expect(counts.round2Plus).toBe(1);
    expect(counts.offer).toBe(1);
  });

  it("splits never-interviewed records into No Response and Rejected before interview", () => {
    const counts = countSearchLogFlow([
      bucket("active", "no_response", 10),
      bucket("rejected", "rejected", 7),
      bucket("rejected", "no_response", 2),
      bucket("active", "rejected", 1)
    ]);

    expect(counts.noResponse).toBe(10);
    expect(counts.rejectedBeforeInterview).toBe(10);
    expect(counts.screening).toBe(0);
    expect(counts.applied).toBe(20);
  });
});

describe("buildSearchLogFlow", () => {
  const search01 = buildSearchLogFlow({
    label: "Search 01",
    buckets: [
      bucket("active", "no_response", 1421),
      bucket("rejected", "rejected", 4091),
      bucket("rejected", "screening_oa", 20),
      bucket("active", "unpaid", 1),
      bucket("rejected", "round_1", 9),
      bucket("rejected", "round_2", 2),
      bucket("rejected", "round_3", 1),
      bucket("active", "offer", 1)
    ]
  });

  it("balances every column against the applications in the cycle", () => {
    expect(search01.counts.applied).toBe(5546);
    expect(nodeValue(search01, "applied")).toBe(5546);
    expect(nodeValue(search01, "screening")).toBe(34);
    expect(nodeValue(search01, "rejected")).toBe(4091);
    expect(nodeValue(search01, "no_response")).toBe(1421);
    expect(34 + 4091 + 1421).toBe(5546);

    expect(nodeValue(search01, "round_1")).toBe(13);
    expect(nodeValue(search01, "dropped_1")).toBe(20);
    expect(nodeValue(search01, "round_2")).toBe(4);
    expect(nodeValue(search01, "dropped_2")).toBe(9);
    expect(nodeValue(search01, "offer")).toBe(1);
    expect(nodeValue(search01, "dropped_3")).toBe(3);
  });

  it("links each column to the next and marks the context flows", () => {
    expect(linkValue(search01, "applied", "screening")).toBe(34);
    expect(linkValue(search01, "applied", "rejected")).toBe(4091);
    expect(linkValue(search01, "applied", "no_response")).toBe(1421);
    expect(linkValue(search01, "screening", "round_1")).toBe(13);
    expect(linkValue(search01, "screening", "dropped_1")).toBe(20);
    expect(linkValue(search01, "round_1", "round_2")).toBe(4);
    expect(linkValue(search01, "round_1", "dropped_2")).toBe(9);
    expect(linkValue(search01, "round_2", "offer")).toBe(1);
    expect(linkValue(search01, "round_2", "dropped_3")).toBe(3);

    const contextLinks = search01.links.filter((link) => link.context);
    expect(contextLinks.map((link) => link.target)).toEqual(["rejected", "no_response"]);
    expect(search01.links.every((link) => link.value >= 0)).toBe(true);
  });

  it("reports each node as a share of applications and of the interviewed subset", () => {
    const screening = search01.nodes.find((node) => node.id === "screening");
    const round1 = search01.nodes.find((node) => node.id === "round_1");
    const offer = search01.nodes.find((node) => node.id === "offer");

    expect(screening?.pctOfApplied).toBe(0.6);
    expect(screening?.pctOfScreened).toBe(100);
    expect(round1?.pctOfApplied).toBe(0.2);
    expect(round1?.pctOfScreened).toBe(38.2);
    expect(offer?.pctOfScreened).toBe(2.9);
    expect(screening?.focusable).toBe(true);
    expect(
      search01.nodes.filter((node) => node.context).map((node) => node.id)
    ).toEqual(["rejected", "no_response"]);
  });

  it("handles a cycle with no interview stages (Search 02)", () => {
    const search02 = buildSearchLogFlow({
      label: "Search 02",
      buckets: [
        bucket("active", "no_response", 3, "Search 02"),
        bucket("rejected", "rejected", 50, "Search 02")
      ]
    });

    expect(search02.counts.applied).toBe(53);
    expect(search02.counts.screening).toBe(0);
    expect(nodeValue(search02, "screening")).toBe(0);
    expect(nodeValue(search02, "round_1")).toBe(0);
    expect(nodeValue(search02, "offer")).toBe(0);
    expect(nodeValue(search02, "dropped_3")).toBe(0);
    expect(nodeValue(search02, "rejected")).toBe(50);
    expect(nodeValue(search02, "no_response")).toBe(3);

    for (const node of search02.nodes) {
      expect(node.pctOfScreened).toBeNull();
    }
    expect(search02.nodes.find((node) => node.id === "rejected")?.pctOfApplied).toBe(94.3);
    expect(
      search02.links.filter((link) => link.value > 0).map((link) => link.target)
    ).toEqual(["rejected", "no_response"]);
  });

  it("returns an all-zero flow for an empty cycle", () => {
    const empty = buildSearchLogFlow({ label: "Search 03", buckets: [] });

    expect(empty.counts.applied).toBe(0);
    expect(empty.nodes.every((node) => node.value === 0)).toBe(true);
    expect(empty.nodes.every((node) => node.pctOfApplied === 0)).toBe(true);
    expect(empty.links.every((link) => link.value === 0)).toBe(true);
  });
});

describe("percentOf", () => {
  it("rounds to one decimal and refuses a zero denominator", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(34, 5546)).toBe(0.6);
    expect(percentOf(0, 10)).toBe(0);
    expect(percentOf(5, 0)).toBeNull();
  });
});
