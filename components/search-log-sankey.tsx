"use client";

import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { jobStageLabels } from "@/lib/job-stage";
import type {
  JobPool,
  JobStage,
  SearchLogAnalytics,
  SearchLogCycleAnalytics
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type SankeyNode = {
  name: string;
  color: string;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  value?: number;
};

type SankeyLink = {
  source: string | SankeyNode;
  target: string | SankeyNode;
  value: number;
  color: string;
  width?: number;
};

const chartWidth = 980;
const chartHeight = 420;
const rootLabel = "Applications";

const stageProgression: Record<JobStage, string[]> = {
  no_response: [jobStageLabels.no_response],
  rejected: [jobStageLabels.rejected],
  screening_oa: [jobStageLabels.screening_oa],
  unpaid: [jobStageLabels.unpaid],
  round_1: [jobStageLabels.screening_oa, jobStageLabels.round_1],
  round_2: [jobStageLabels.screening_oa, jobStageLabels.round_1, jobStageLabels.round_2],
  round_3: [
    jobStageLabels.screening_oa,
    jobStageLabels.round_1,
    jobStageLabels.round_2,
    jobStageLabels.round_3
  ],
  round_4: [
    jobStageLabels.screening_oa,
    jobStageLabels.round_1,
    jobStageLabels.round_2,
    jobStageLabels.round_3,
    jobStageLabels.round_4
  ],
  round_5: [
    jobStageLabels.screening_oa,
    jobStageLabels.round_1,
    jobStageLabels.round_2,
    jobStageLabels.round_3,
    jobStageLabels.round_4,
    jobStageLabels.round_5
  ],
  offer: [
    jobStageLabels.screening_oa,
    jobStageLabels.round_1,
    jobStageLabels.round_2,
    jobStageLabels.round_3,
    jobStageLabels.round_4,
    jobStageLabels.round_5,
    jobStageLabels.offer
  ]
};

const nodeColors: Record<string, string> = {
  [rootLabel]: "#b9b0aa",
  [jobStageLabels.rejected]: "#4f7ead",
  [jobStageLabels.no_response]: "#f28c28",
  [jobStageLabels.screening_oa]: "#f05d5e",
  [jobStageLabels.unpaid]: "#72b7b2",
  [jobStageLabels.round_1]: "#78b878",
  [jobStageLabels.round_2]: "#7fc97f",
  [jobStageLabels.round_3]: "#8dd187",
  [jobStageLabels.round_4]: "#a6d98e",
  [jobStageLabels.round_5]: "#e3c95b",
  [jobStageLabels.offer]: "#e6b14a"
};

function pathForBucket(input: {
  pool: JobPool;
  stage: JobStage;
}) {
  if (input.pool === "active" && input.stage === "no_response") {
    return [rootLabel, jobStageLabels.no_response];
  }

  if (
    input.pool === "rejected" &&
    (input.stage === "no_response" || input.stage === "rejected")
  ) {
    return [rootLabel, jobStageLabels.rejected];
  }

  const path = [rootLabel, ...(stageProgression[input.stage] ?? [])];
  const terminal = path[path.length - 1];

  if (input.pool === "rejected" && terminal !== jobStageLabels.rejected) {
    path.push(jobStageLabels.rejected);
  }

  return path;
}

function buildSankeyGraph(cycle: SearchLogCycleAnalytics | undefined) {
  const nodeNames = new Set<string>([rootLabel]);
  const linkMap = new Map<string, SankeyLink>();

  for (const bucket of cycle?.buckets ?? []) {
    const path = pathForBucket(bucket);
    for (const name of path) {
      nodeNames.add(name);
    }

    for (let index = 0; index < path.length - 1; index += 1) {
      const source = path[index];
      const target = path[index + 1];
      if (!source || !target) {
        continue;
      }

      const key = `${source}\u0000${target}`;
      const current = linkMap.get(key);
      if (current) {
        current.value += bucket.count;
      } else {
        linkMap.set(key, {
          source,
          target,
          value: bucket.count,
          color: nodeColors[target] ?? "#8aa8c5"
        });
      }
    }
  }

  const nodes = Array.from(nodeNames).map((name) => ({
    name,
    color: nodeColors[name] ?? "#8aa8c5"
  }));
  const links = Array.from(linkMap.values());

  if (links.length === 0) {
    return { nodes: [], links: [] };
  }

  return sankey<SankeyNode, SankeyLink>()
    .nodeId((node) => node.name)
    .nodeWidth(22)
    .nodePadding(24)
    .nodeAlign((node) => {
      if (node.name === rootLabel) {
        return 0;
      }

      if (
        node.name === jobStageLabels.rejected ||
        node.name === jobStageLabels.no_response ||
        node.name === jobStageLabels.unpaid
      ) {
        return 2;
      }

      const order = [
        jobStageLabels.screening_oa,
        jobStageLabels.round_1,
        jobStageLabels.round_2,
        jobStageLabels.round_3,
        jobStageLabels.round_4,
        jobStageLabels.round_5,
        jobStageLabels.offer
      ];
      return Math.min(order.indexOf(node.name) + 1, order.length);
    })
    .extent([
      [16, 18],
      [chartWidth - 16, chartHeight - 18]
    ])({
    nodes,
    links
  });
}

function nodeLabelX(node: SankeyNode) {
  const center = ((node.x0 ?? 0) + (node.x1 ?? 0)) / 2;
  return center < chartWidth / 2 ? (node.x1 ?? 0) + 10 : (node.x0 ?? 0) - 10;
}

function nodeLabelAnchor(node: SankeyNode) {
  const center = ((node.x0 ?? 0) + (node.x1 ?? 0)) / 2;
  return center < chartWidth / 2 ? "start" : "end";
}

export function SearchLogSankey({
  analytics
}: {
  analytics: SearchLogAnalytics;
}) {
  const [selectedLabel, setSelectedLabel] = useState(
    analytics.cycles.at(-1)?.label ?? ""
  );
  const selectedCycle =
    analytics.cycles.find((cycle) => cycle.label === selectedLabel) ??
    analytics.cycles.at(-1);
  const graph = useMemo(() => buildSankeyGraph(selectedCycle), [selectedCycle]);
  const linkPath = sankeyLinkHorizontal<SankeyNode, SankeyLink>();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Selected Cycle
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedCycle?.label ?? "No data"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Applications
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedCycle?.total ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Sunken Active
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {analytics.sunkenActiveCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Active before {formatDate(analytics.sunkenThresholdDate)}
          </p>
        </div>
      </div>

      {analytics.cycles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {analytics.cycles.map((cycle) => (
            <button
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                cycle.label === selectedCycle?.label
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-white/75 text-muted-foreground hover:text-foreground"
              )}
              key={cycle.label}
              onClick={() => setSelectedLabel(cycle.label)}
              type="button"
            >
              {cycle.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[24px] border border-border bg-white">
        {graph.links.length > 0 ? (
          <svg
            aria-label={`${selectedCycle?.label ?? "Search cycle"} Sankey flow`}
            className="min-w-[840px]"
            role="img"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <g fill="none">
              {graph.links.map((link, index) => (
                <path
                  d={linkPath(link) ?? undefined}
                  key={`${index}-${String((link.source as SankeyNode).name)}`}
                  opacity={0.38}
                  stroke={link.color}
                  strokeWidth={Math.max(1, link.width ?? 1)}
                />
              ))}
            </g>
            <g>
              {graph.nodes.map((node) => (
                <g key={node.name}>
                  <rect
                    fill={node.color}
                    height={(node.y1 ?? 0) - (node.y0 ?? 0)}
                    rx={2}
                    width={(node.x1 ?? 0) - (node.x0 ?? 0)}
                    x={node.x0}
                    y={node.y0}
                  />
                  <text
                    dominantBaseline="middle"
                    fill="#171717"
                    fontSize={15}
                    fontWeight={600}
                    textAnchor={nodeLabelAnchor(node)}
                    x={nodeLabelX(node)}
                    y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
                  >
                    <tspan x={nodeLabelX(node)}>{node.value ?? 0}</tspan>
                    <tspan
                      dy="1.25em"
                      fontSize={13}
                      fontWeight={500}
                      x={nodeLabelX(node)}
                    >
                      {node.name}
                    </tspan>
                  </text>
                </g>
              ))}
            </g>
          </svg>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-base font-semibold text-foreground">
              No Sankey data yet
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Save records with a search cycle label to populate this chart.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
