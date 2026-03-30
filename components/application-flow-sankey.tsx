"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatJobStageLabel } from "@/lib/job-stage";
import { Surface } from "@/components/ui/surface";
import { formatDate } from "@/lib/utils";
import type {
  ApplicationFlowRecordPreview,
  ApplicationFlowSankeyData,
  JobPool,
  JobStage
} from "@/lib/types";

type StageAfterApplied = Exclude<JobStage, "applied">;

type FlowBranch = {
  id: `${StageAfterApplied}-to-${JobPool}`;
  stage: StageAfterApplied;
  pool: JobPool;
  count: number;
};

type ChartNode = {
  id: string;
  kind: "root" | "stage" | "outcome";
  label: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

type ChartLink = {
  id: string;
  kind: "root-to-stage" | "stage-to-outcome";
  stage: StageAfterApplied;
  count: number;
  width: number;
  stroke: string;
  path: string;
  branch?: FlowBranch;
};

type ChartLayout = {
  width: number;
  height: number;
  visualizedCount: number;
  hiddenAppliedCount: number;
  rootNode: ChartNode;
  stageNodes: ChartNode[];
  outcomeNodes: ChartNode[];
  links: ChartLink[];
};

const stageOrder: StageAfterApplied[] = [
  "hr_reach_out",
  "oa",
  "first_round",
  "second_plus_round",
  "offer"
];

const outcomeLabels: Record<JobPool, string> = {
  active: "Active",
  rejected: "Rejected"
};

const outcomeStroke: Record<JobPool, string> = {
  active: "rgba(122, 111, 198, 0.82)",
  rejected: "rgba(228, 77, 149, 0.82)"
};

const outcomeFill: Record<JobPool, string> = {
  active: "#7a6fc6",
  rejected: "#e44d95"
};

const stageFill: Record<StageAfterApplied, string> = {
  hr_reach_out: "#f1b56e",
  oa: "#9bc67e",
  first_round: "#caa35a",
  second_plus_round: "#5f84c9",
  offer: "#28ad9e"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildFlowPath(startX: number, startY: number, endX: number, endY: number) {
  const dx = (endX - startX) * 0.42;
  return [
    `M ${startX} ${startY}`,
    `C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`
  ].join(" ");
}

function getBranchLabel(branch: FlowBranch) {
  return `${formatJobStageLabel(branch.stage)} -> ${outcomeLabels[branch.pool]}`;
}

function filterBranchRecords(branch: FlowBranch, records: ApplicationFlowRecordPreview[]) {
  return records.filter((record) => record.stage === branch.stage && record.pool === branch.pool);
}

function buildChartLayout(data: ApplicationFlowSankeyData): ChartLayout | null {
  const visibleLinks = data.links
    .filter((entry) => entry.stage !== "applied" && entry.count > 0)
    .map((entry) => ({
      stage: entry.stage as StageAfterApplied,
      pool: entry.pool,
      count: entry.count
    }));

  const visualizedCount = visibleLinks.reduce((sum, entry) => sum + entry.count, 0);
  if (visualizedCount === 0) {
    return null;
  }

  const hiddenAppliedCount = Math.max(0, data.totalRecords - visualizedCount);
  const stageTotals = new Map<StageAfterApplied, number>();
  const outcomeTotals = new Map<JobPool, number>([
    ["active", 0],
    ["rejected", 0]
  ]);

  for (const entry of visibleLinks) {
    stageTotals.set(entry.stage, (stageTotals.get(entry.stage) ?? 0) + entry.count);
    outcomeTotals.set(entry.pool, (outcomeTotals.get(entry.pool) ?? 0) + entry.count);
  }

  const visibleStages = stageOrder.filter((stage) => (stageTotals.get(stage) ?? 0) > 0);
  const unit = clamp(300 / Math.max(visualizedCount, 1), 8, 22);
  const rootVisibleHeight = visualizedCount * unit;
  const width = 1100;

  const stageStartX = 310;
  const stageEndX = 820;
  const stageBaseY = 108;
  const stageStepY = 72;
  const stageMinGap = 38;
  const stageNodeWidth = 18;
  const outcomeNodeWidth = 22;
  const rootNodeWidth = 24;

  const stageNodes: ChartNode[] = [];
  let previousStageBottom = 0;
  for (const [index, stage] of visibleStages.entries()) {
    const total = stageTotals.get(stage) ?? 0;
    const height = Math.max(30, total * unit);
    const x =
      visibleStages.length === 1
        ? (stageStartX + stageEndX) / 2
        : stageStartX + ((stageEndX - stageStartX) / (visibleStages.length - 1)) * index;
    const desiredY = stageBaseY + index * stageStepY;
    const y =
      index === 0 ? desiredY : Math.max(desiredY, previousStageBottom + stageMinGap);

    stageNodes.push({
      id: `stage:${stage}`,
      kind: "stage",
      label: formatJobStageLabel(stage),
      count: total,
      x,
      y,
      width: stageNodeWidth,
      height,
      fill: stageFill[stage]
    });

    previousStageBottom = y + height;
  }

  const stageTop = stageNodes[0]?.y ?? stageBaseY;
  const stageBottom = stageNodes.at(-1)?.y ?? stageBaseY;
  const rootHeight = Math.max(230, previousStageBottom - stageTop + 52);
  const rootY = Math.max(70, stageTop - 22);
  const rootVisibleStartY = rootY + (rootHeight - rootVisibleHeight) / 2;

  const rootNode: ChartNode = {
    id: "root:applications",
    kind: "root",
    label: "Applications",
    count: data.totalRecords,
    x: 92,
    y: rootY,
    width: rootNodeWidth,
    height: rootHeight,
    fill: "#2fa089"
  };

  const rejectedHeight = Math.max(30, (outcomeTotals.get("rejected") ?? 0) * unit);
  const activeHeight = Math.max(30, (outcomeTotals.get("active") ?? 0) * unit);
  const rejectedY = Math.max(88, rootY - 4);
  const activeY = Math.max(previousStageBottom - activeHeight + 20, rejectedY + rejectedHeight + 108);

  const rawOutcomeNodes: ChartNode[] = [
    {
      id: "outcome:rejected",
      kind: "outcome",
      label: outcomeLabels.rejected,
      count: outcomeTotals.get("rejected") ?? 0,
      x: 980,
      y: rejectedY,
      width: outcomeNodeWidth,
      height: rejectedHeight,
      fill: outcomeFill.rejected
    },
    {
      id: "outcome:active",
      kind: "outcome",
      label: outcomeLabels.active,
      count: outcomeTotals.get("active") ?? 0,
      x: 980,
      y: activeY,
      width: outcomeNodeWidth,
      height: activeHeight,
      fill: outcomeFill.active
    }
  ];
  const outcomeNodes = rawOutcomeNodes.filter((node) => node.count > 0);

  const outcomeByPool = new Map<JobPool, ChartNode>(
    outcomeNodes.map((node) => [
      node.id.endsWith("active") ? "active" : "rejected",
      node
    ])
  );

  const links: ChartLink[] = [];
  let rootCursor = rootVisibleStartY;

  for (const stage of visibleStages) {
    const stageNode = stageNodes.find((node) => node.id === `stage:${stage}`);
    const total = stageTotals.get(stage) ?? 0;
    if (!stageNode || total <= 0) {
      continue;
    }

    const widthForStage = total * unit;
    links.push({
      id: `root-to-${stage}`,
      kind: "root-to-stage",
      stage,
      count: total,
      width: widthForStage,
      stroke: `${stageFill[stage]}CC`,
      path: buildFlowPath(
        rootNode.x + rootNode.width,
        rootCursor + widthForStage / 2,
        stageNode.x,
        stageNode.y + stageNode.height / 2
      )
    });
    rootCursor += widthForStage;
  }

  const outcomeCursor = new Map<JobPool, number>(
    outcomeNodes.map((node) => [
      node.id.endsWith("active") ? "active" : "rejected",
      node.y
    ])
  );

  for (const stage of visibleStages) {
    const stageNode = stageNodes.find((node) => node.id === `stage:${stage}`);
    if (!stageNode) {
      continue;
    }

    let stageCursor = stageNode.y;

    for (const pool of ["rejected", "active"] as const) {
      const count =
        visibleLinks.find((entry) => entry.stage === stage && entry.pool === pool)?.count ?? 0;
      if (count <= 0) {
        continue;
      }

      const outcomeNode = outcomeByPool.get(pool);
      if (!outcomeNode) {
        continue;
      }

      const widthForBranch = count * unit;
      const targetCursor = outcomeCursor.get(pool) ?? outcomeNode.y;
      const branch: FlowBranch = {
        id: `${stage}-to-${pool}`,
        stage,
        pool,
        count
      };

      links.push({
        id: branch.id,
        kind: "stage-to-outcome",
        stage,
        count,
        width: widthForBranch,
        stroke: outcomeStroke[pool],
        path: buildFlowPath(
          stageNode.x + stageNode.width,
          stageCursor + widthForBranch / 2,
          outcomeNode.x,
          targetCursor + widthForBranch / 2
        ),
        branch
      });

      stageCursor += widthForBranch;
      outcomeCursor.set(pool, targetCursor + widthForBranch);
    }
  }

  const height = Math.max(
    500,
    rootNode.y + rootNode.height + 68,
    ...outcomeNodes.map((node) => node.y + node.height + 72),
    ...stageNodes.map((node) => node.y + node.height + 60)
  );

  return {
    width,
    height,
    visualizedCount,
    hiddenAppliedCount,
    rootNode,
    stageNodes,
    outcomeNodes,
    links
  };
}

function BranchRecordRow({ record }: { record: ApplicationFlowRecordPreview }) {
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
    return <Link href={`/active/${record.id}`}>{content}</Link>;
  }

  return content;
}

export function ApplicationFlowSankey({ data }: { data: ApplicationFlowSankeyData }) {
  const layout = useMemo(() => buildChartLayout(data), [data]);
  const defaultBranch = useMemo(() => {
    if (!layout) {
      return null;
    }

    return (
      layout.links
        .filter((link): link is ChartLink & { branch: FlowBranch } => Boolean(link.branch))
        .sort((left, right) => right.count - left.count)[0]?.branch ?? null
    );
  }, [layout]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    defaultBranch?.id ?? null
  );

  const selectedBranch =
    layout?.links.find((link) => link.branch?.id === selectedBranchId)?.branch ?? defaultBranch;
  const branchRecords = selectedBranch ? filterBranchRecords(selectedBranch, data.records) : [];

  if (data.totalRecords === 0) {
    return (
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Application Flow
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">No records yet</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Save a few applications first. The flow view will start charting progressed
          records once they move beyond the applied stage.
        </p>
      </Surface>
    );
  }

  if (!layout) {
    return (
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Application Flow
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          No progressed records yet
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          You have {data.totalRecords} saved application{data.totalRecords === 1 ? "" : "s"}, but
          none have moved beyond the applied stage yet. This chart only visualizes records
          once they reach a later confirmed stage.
        </p>
      </Surface>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
      <Surface className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Application Flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Sankey overview</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              The total on the left counts every saved application. The flow itself only
              visualizes records that moved beyond the applied stage, using each record&apos;s
              current highest confirmed stage and current outcome.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              All applications {data.totalRecords}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Visualized {layout.visualizedCount}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Applied-only hidden {layout.hiddenAppliedCount}
            </span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(246,243,250,0.95),rgba(255,255,255,0.98)_44%,rgba(250,248,252,0.94))] p-5">
          <svg
            aria-label="Application flow sankey chart"
            className="h-auto min-w-[980px] w-full"
            role="img"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {layout.links.map((link) => {
              if (!link.branch) {
                return (
                  <path
                    key={link.id}
                    d={link.path}
                    fill="none"
                    opacity={0.86}
                    stroke={link.stroke}
                    strokeWidth={link.width}
                  />
                );
              }

              const selected = selectedBranchId === link.branch.id;
              return (
                <g
                  aria-label={getBranchLabel(link.branch)}
                  key={link.id}
                  onClick={() => setSelectedBranchId(link.branch?.id ?? null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedBranchId(link.branch?.id ?? null);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <path
                    d={link.path}
                    fill="none"
                    opacity={selected ? 1 : 0.92}
                    stroke={link.stroke}
                    strokeWidth={link.width + (selected ? 3 : 0)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              );
            })}

            <rect
              fill={layout.rootNode.fill}
              height={layout.rootNode.height}
              opacity={0.96}
              rx={12}
              width={layout.rootNode.width}
              x={layout.rootNode.x}
              y={layout.rootNode.y}
            />

            {layout.stageNodes.map((node) => (
              <g key={node.id}>
                <rect
                  fill={node.fill}
                  height={node.height}
                  opacity={0.96}
                  rx={10}
                  width={node.width}
                  x={node.x}
                  y={node.y}
                />
                <text
                  className="fill-foreground"
                  fontSize="24"
                  fontWeight="600"
                  x={node.x + node.width + 14}
                  y={node.y + 18}
                >
                  {node.count}
                </text>
                <text
                  className="fill-muted-foreground"
                  fontSize="13"
                  x={node.x + node.width + 14}
                  y={node.y + 36}
                >
                  {node.label}
                </text>
              </g>
            ))}

            {layout.outcomeNodes.map((node) => (
              <g key={node.id}>
                <rect
                  fill={node.fill}
                  height={node.height}
                  opacity={0.98}
                  rx={10}
                  width={node.width}
                  x={node.x}
                  y={node.y}
                />
                <text
                  className="fill-foreground"
                  fontSize="26"
                  fontWeight="600"
                  x={node.x + node.width + 14}
                  y={node.y + 18}
                >
                  {node.count}
                </text>
                <text
                  className="fill-muted-foreground"
                  fontSize="14"
                  x={node.x + node.width + 14}
                  y={node.y + 38}
                >
                  {node.label}
                </text>
              </g>
            ))}

            <g>
              <text
                className="fill-foreground"
                fontSize="34"
                fontWeight="600"
                textAnchor="end"
                x={layout.rootNode.x - 18}
                y={layout.rootNode.y + 10}
              >
                {data.totalRecords}
              </text>
              <text
                className="fill-muted-foreground"
                fontSize="15"
                textAnchor="end"
                x={layout.rootNode.x - 18}
                y={layout.rootNode.y + 32}
              >
                Applications
              </text>
              <text
                className="fill-muted-foreground"
                fontSize="12"
                textAnchor="end"
                x={layout.rootNode.x - 18}
                y={layout.rootNode.y + 52}
              >
                {layout.visualizedCount} beyond applied
              </text>
            </g>
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
            Click a stage-to-outcome branch to inspect the records behind it.
          </div>
        )}
      </Surface>
    </div>
  );
}
