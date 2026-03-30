"use client";

import Link from "next/link";
import { useState } from "react";
import {
  sankey,
  sankeyJustify,
  sankeyLinkHorizontal,
  type SankeyGraph,
  type SankeyLinkMinimal,
  type SankeyNodeMinimal
} from "d3-sankey";
import { formatJobStageLabel } from "@/lib/job-stage";
import { Surface } from "@/components/ui/surface";
import { cn, formatDate } from "@/lib/utils";
import type {
  ApplicationFlowRecordPreview,
  ApplicationFlowSankeyData,
  JobPool,
  JobStage
} from "@/lib/types";

type SankeyColumn = "root" | "stage" | "outcome";
type StageAfterApplied = Exclude<JobStage, "applied">;

type FlowBranch =
  | {
      id: "applied-to-active" | "applied-to-rejected";
      kind: "direct";
      pool: JobPool;
      count: number;
    }
  | {
      id: `applied-to-${StageAfterApplied}`;
      kind: "root-to-stage";
      stage: StageAfterApplied;
      count: number;
    }
  | {
      id: `${StageAfterApplied}-to-active` | `${StageAfterApplied}-to-rejected`;
      kind: "stage-to-outcome";
      stage: StageAfterApplied;
      pool: JobPool;
      count: number;
    };

type FlowNode = SankeyNodeMinimal<FlowNode, FlowLink> & {
  id: string;
  label: string;
  column: SankeyColumn;
  fill: string;
};

type FlowLink = SankeyLinkMinimal<FlowNode, FlowLink> & {
  source: string | FlowNode;
  target: string | FlowNode;
  value: number;
  stroke: string;
  branch: FlowBranch;
};

const outcomeLabels: Record<JobPool, string> = {
  active: "Active",
  rejected: "Rejected"
};

const columnHeaders: Array<{ id: SankeyColumn; label: string }> = [
  { id: "root", label: "Applied" },
  { id: "stage", label: "Highest Confirmed Stage" },
  { id: "outcome", label: "Current Outcome" }
];

function compareStages(left: JobStage, right: JobStage) {
  const stageOrder: JobStage[] = [
    "applied",
    "hr_reach_out",
    "oa",
    "first_round",
    "second_plus_round",
    "offer"
  ];
  return stageOrder.indexOf(left) - stageOrder.indexOf(right);
}

function buildSankeyGraph(data: ApplicationFlowSankeyData) {
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();

  const ensureNode = (id: string, label: string, column: SankeyColumn, fill: string) => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label,
        column,
        fill
      });
    }
  };

  ensureNode("root:applied", "Applied", "root", "#2da58f");

  const directRows = data.links
    .filter((entry) => entry.stage === "applied")
    .sort((left, right) => left.pool.localeCompare(right.pool));
  const stagedRows = data.links
    .filter((entry) => entry.stage !== "applied")
    .sort((left, right) => {
      const stageOrder = compareStages(left.stage, right.stage);
      if (stageOrder !== 0) {
        return stageOrder;
      }

      return left.pool.localeCompare(right.pool);
    });

  for (const entry of directRows) {
    const outcomeId = `outcome:${entry.pool}`;
    ensureNode(outcomeId, outcomeLabels[entry.pool], "outcome", entry.pool === "active" ? "#8f81bd" : "#c8bfdc");

    const branch: FlowBranch =
      entry.pool === "active"
        ? { id: "applied-to-active", kind: "direct", pool: "active", count: entry.count }
        : { id: "applied-to-rejected", kind: "direct", pool: "rejected", count: entry.count };

    links.set(branch.id, {
      source: "root:applied",
      target: outcomeId,
      value: entry.count,
      stroke: entry.pool === "active" ? "rgba(101, 87, 159, 0.42)" : "rgba(147, 136, 189, 0.48)",
      branch
    });
  }

  const stagedTotals = new Map<StageAfterApplied, number>();
  for (const entry of stagedRows) {
    const stage = entry.stage as StageAfterApplied;
    stagedTotals.set(stage, (stagedTotals.get(stage) ?? 0) + entry.count);
  }

  for (const [stage, total] of stagedTotals) {
    const stageId = `stage:${stage}`;
    ensureNode(stageId, formatJobStageLabel(stage), "stage", "#f0b86f");

    const branch: FlowBranch = {
      id: `applied-to-${stage}`,
      kind: "root-to-stage",
      stage,
      count: total
    };

    links.set(branch.id, {
      source: "root:applied",
      target: stageId,
      value: total,
      stroke: "rgba(235, 165, 82, 0.6)",
      branch
    });
  }

  for (const entry of stagedRows) {
    const stage = entry.stage as StageAfterApplied;
    const stageId = `stage:${stage}`;
    const outcomeId = `outcome:${entry.pool}`;

    ensureNode(outcomeId, outcomeLabels[entry.pool], "outcome", entry.pool === "active" ? "#8f81bd" : "#c8bfdc");

    const branch: FlowBranch =
      entry.pool === "active"
        ? { id: `${stage}-to-active`, kind: "stage-to-outcome", stage, pool: "active", count: entry.count }
        : {
            id: `${stage}-to-rejected`,
            kind: "stage-to-outcome",
            stage,
            pool: "rejected",
            count: entry.count
          };

    links.set(branch.id, {
      source: stageId,
      target: outcomeId,
      value: entry.count,
      stroke: entry.pool === "active" ? "rgba(120, 179, 139, 0.62)" : "rgba(236, 140, 183, 0.68)",
      branch
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values())
  };
}

function layoutSankey(data: ApplicationFlowSankeyData) {
  const graph = buildSankeyGraph(data);
  const width = 960;
  const height = Math.max(360, graph.nodes.length * 64);

  const generator = sankey<FlowNode, FlowLink>()
    .nodeId((node) => node.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(20)
    .nodePadding(26)
    .extent([
      [28, 28],
      [width - 28, height - 28]
    ]);

  const laidOut = generator({
    nodes: graph.nodes.map((node) => ({ ...node })),
    links: graph.links.map((link) => ({ ...link }))
  });

  return { width, height, graph: laidOut };
}

function getBranchLabel(branch: FlowBranch) {
  if (branch.kind === "direct") {
    return `Applied -> ${outcomeLabels[branch.pool]}`;
  }

  if (branch.kind === "root-to-stage") {
    return `Applied -> ${formatJobStageLabel(branch.stage)}`;
  }

  return `${formatJobStageLabel(branch.stage)} -> ${outcomeLabels[branch.pool]}`;
}

function filterBranchRecords(
  branch: FlowBranch,
  records: ApplicationFlowRecordPreview[]
) {
  return records.filter((record) => {
    if (branch.kind === "direct") {
      return record.stage === "applied" && record.pool === branch.pool;
    }

    if (branch.kind === "root-to-stage") {
      return record.stage === branch.stage;
    }

    return record.stage === branch.stage && record.pool === branch.pool;
  });
}

function renderLinkPath(
  graph: SankeyGraph<FlowNode, FlowLink>,
  index: number,
  selectedBranchId: string | null,
  onSelect: (branch: FlowBranch) => void
) {
  const link = graph.links[index];
  if (!link) {
    return null;
  }

  const path = sankeyLinkHorizontal<FlowNode, FlowLink>()(link);
  if (!path) {
    return null;
  }

  const selected = selectedBranchId === link.branch.id;

  return (
    <g
      aria-label={getBranchLabel(link.branch)}
      key={`${link.branch.id}-${index}`}
      onClick={() => onSelect(link.branch)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(link.branch);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <path
        d={path}
        fill="none"
        opacity={selected ? 1 : 0.88}
        stroke={link.stroke}
        strokeWidth={Math.max(2, (link.width ?? 1) + (selected ? 1.5 : 0))}
        style={{ cursor: "pointer" }}
      />
    </g>
  );
}

function BranchRecordRow({
  record
}: {
  record: ApplicationFlowRecordPreview;
}) {
  const content = (
    <div className="rounded-[22px] border border-border/80 bg-white/90 p-4 transition hover:border-accent/20 hover:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{record.roleTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{record.company}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>{formatJobStageLabel(record.stage)}</span>
          <span>{record.pool}</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{record.location}</p>
      <p className="mt-2 text-xs text-muted-foreground">{formatDate(record.timestamp)}</p>
      {record.hasComments ? (
        <p className="mt-3 text-sm leading-6 text-foreground/85">{record.commentsPreview}</p>
      ) : null}
    </div>
  );

  if (record.pool === "active") {
    return (
      <Link href={`/active/${record.id}`}>
        {content}
      </Link>
    );
  }

  return content;
}

export function ApplicationFlowSankey({
  data
}: {
  data: ApplicationFlowSankeyData;
}) {
  const { width, height, graph } = layoutSankey(data);
  const defaultBranch = graph.links[0]?.branch ?? null;
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    defaultBranch?.id ?? null
  );

  const selectedBranch =
    graph.links.find((link) => link.branch.id === selectedBranchId)?.branch ?? defaultBranch;
  const branchRecords = selectedBranch
    ? filterBranchRecords(selectedBranch, data.records)
    : [];

  if (data.totalRecords === 0) {
    return (
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Application Flow
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          No records yet
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Save a few applications first. The Sankey view will start charting applied,
          highest confirmed stage, and current outcome once records exist.
        </p>
      </Surface>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_380px]">
      <Surface className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Application Flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              Sankey overview
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This chart uses each record&apos;s current highest confirmed stage and
              current outcome. It is a truthful overview of where records stand today,
              not a full event-history reconstruction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Total {data.totalRecords}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Active {data.activeCount}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Rejected {data.rejectedCount}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:grid-cols-3">
          {columnHeaders.map((column) => (
            <div key={column.id}>{column.label}</div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,245,250,0.92))] p-4">
          <svg
            aria-label="Application flow sankey chart"
            className="h-auto min-w-[880px] w-full"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            {graph.links.map((_, index) =>
              renderLinkPath(graph, index, selectedBranchId, (branch) => {
                setSelectedBranchId(branch.id);
              })
            )}
            {graph.nodes.map((node, index) => (
              <g key={`${node.id}-${index}`}>
                <rect
                  fill={node.fill}
                  height={Math.max(14, (node.y1 ?? 0) - (node.y0 ?? 0))}
                  opacity={0.95}
                  rx={10}
                  width={Math.max(14, (node.x1 ?? 0) - (node.x0 ?? 0))}
                  x={node.x0}
                  y={node.y0}
                />
                <text
                  className="fill-foreground"
                  fontSize="12"
                  fontWeight="600"
                  x={node.x0}
                  y={Math.max(14, (node.y0 ?? 0) - 8)}
                >
                  {node.label}
                </text>
                <text
                  className="fill-muted-foreground"
                  fontSize="11"
                  x={node.x0}
                  y={Math.max(28, (node.y0 ?? 0) + 16)}
                >
                  {node.value ?? 0}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </Surface>

      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Branch Records
        </p>
        {selectedBranch ? (
          <>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              {getBranchLabel(selectedBranch)}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {branchRecords.length} record{branchRecords.length === 1 ? "" : "s"} in this
              branch. Active records open their existing detail page; Rejected records stay
              read-only here.
            </p>
            <div className="mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {branchRecords.length > 0 ? (
                branchRecords.map((record) => (
                  <BranchRecordRow key={record.id} record={record} />
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No records landed in this branch.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-[22px] border border-dashed border-border p-5 text-sm text-muted-foreground">
            Click a Sankey branch to inspect the records behind it.
          </div>
        )}
      </Surface>
    </div>
  );
}
