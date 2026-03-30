"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatJobStageLabel } from "@/lib/job-stage";
import { Surface } from "@/components/ui/surface";
import { formatDate } from "@/lib/utils";
import type {
  ApplicationFlowRecordPreview,
  ApplicationFlowSankeyData,
  ApplicationFlowSankeyLink,
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
  kind: "root-to-outcome" | "root-to-stage" | "stage-to-outcome";
  count: number;
  width: number;
  stroke: string;
  path: string;
  branch?: FlowBranch;
};

type ChartLayout = {
  width: number;
  height: number;
  progressedCount: number;
  appliedActiveCount: number;
  appliedRejectedCount: number;
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

const rootFill = "#5a8f87";

const outcomeFill: Record<JobPool, string> = {
  active: "#7a85a9",
  rejected: "#b47a96"
};

const directOutcomeStroke: Record<JobPool, string> = {
  active: "rgba(122, 133, 169, 0.42)",
  rejected: "rgba(180, 122, 150, 0.42)"
};

const outcomeBranchStroke: Record<JobPool, string> = {
  active: "rgba(122, 133, 169, 0.74)",
  rejected: "rgba(180, 122, 150, 0.74)"
};

const stageFill: Record<StageAfterApplied, string> = {
  hr_reach_out: "#b69362",
  oa: "#8da580",
  first_round: "#9b8f72",
  second_plus_round: "#7887a1",
  offer: "#6b9a93"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function bandWidth(count: number, scale: number) {
  if (count <= 0) {
    return 0;
  }

  return Math.max(10, count * scale);
}

function buildFlowPath(startX: number, startY: number, endX: number, endY: number) {
  const dx = (endX - startX) * 0.42;
  return [
    `M ${startX} ${startY}`,
    `C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`
  ].join(" ");
}

function getCount(links: ApplicationFlowSankeyLink[], stage: JobStage, pool: JobPool) {
  return links.find((entry) => entry.stage === stage && entry.pool === pool)?.count ?? 0;
}

function getBranchLabel(branch: FlowBranch) {
  return `${formatJobStageLabel(branch.stage)} -> ${outcomeLabels[branch.pool]}`;
}

function filterBranchRecords(branch: FlowBranch, records: ApplicationFlowRecordPreview[]) {
  return records.filter((record) => record.stage === branch.stage && record.pool === branch.pool);
}

function buildChartLayout(data: ApplicationFlowSankeyData): ChartLayout {
  const appliedActiveCount = getCount(data.links, "applied", "active");
  const appliedRejectedCount = getCount(data.links, "applied", "rejected");
  const stagedLinks = data.links
    .filter((entry) => entry.stage !== "applied" && entry.count > 0)
    .map((entry) => ({
      stage: entry.stage as StageAfterApplied,
      pool: entry.pool,
      count: entry.count
    }));

  const stageOutcomeWidths = new Map<string, number>();
  const stageTotals = new Map<StageAfterApplied, number>();
  const scale = clamp(400 / Math.max(data.totalRecords, 1), 0.06, 22);

  for (const entry of stagedLinks) {
    const width = bandWidth(entry.count, scale);
    stageOutcomeWidths.set(`${entry.stage}:${entry.pool}`, width);
    stageTotals.set(entry.stage, (stageTotals.get(entry.stage) ?? 0) + width);
  }

  const visibleStages = stageOrder.filter((stage) => (stageTotals.get(stage) ?? 0) > 0);
  const progressedCount = stagedLinks.reduce((sum, entry) => sum + entry.count, 0);

  const directRejectedWidth = bandWidth(appliedRejectedCount, scale);
  const directActiveWidth = bandWidth(appliedActiveCount, scale);
  const rootSegments = [
    directRejectedWidth > 0
      ? { id: "direct:rejected", width: directRejectedWidth }
      : null,
    directActiveWidth > 0
      ? { id: "direct:active", width: directActiveWidth }
      : null,
    ...visibleStages.map((stage) => ({
      id: `stage:${stage}`,
      width: stageTotals.get(stage) ?? 0
    }))
  ].filter((segment): segment is { id: string; width: number } => Boolean(segment));

  const width = 1340;
  const rootGap = 24;
  const rootX = 96;
  const rootY = 96;
  const rootInnerTop = rootY + 20;
  const rootSegmentTop = new Map<string, number>();
  let rootCursor = rootInnerTop;

  for (const segment of rootSegments) {
    rootSegmentTop.set(segment.id, rootCursor);
    rootCursor += segment.width + rootGap;
  }

  const rootHeight = Math.max(260, rootCursor - rootY - rootGap + 20);
  const rootNode: ChartNode = {
    id: "root:applications",
    label: "Applications",
    count: data.totalRecords,
    x: rootX,
    y: rootY,
    width: 26,
    height: rootHeight,
    fill: rootFill
  };

  const stageXStart = 400;
  const stageXEnd = 920;
  const stageNodeWidth = 18;
  const stageNodes: ChartNode[] = [];
  let previousStageBottom = rootY + 160;

  for (const [index, stage] of visibleStages.entries()) {
    const totalWidth = stageTotals.get(stage) ?? 0;
    const stageSegmentTop = rootSegmentTop.get(`stage:${stage}`) ?? rootInnerTop;
    const x =
      visibleStages.length === 1
        ? (stageXStart + stageXEnd) / 2
        : stageXStart + ((stageXEnd - stageXStart) / (visibleStages.length - 1)) * index;
    const desiredY = stageSegmentTop + index * 28;
    const y =
      index === 0
        ? desiredY
        : Math.max(desiredY, previousStageBottom + 34);

    stageNodes.push({
      id: `stage:${stage}`,
      label: formatJobStageLabel(stage),
      count: stagedLinks
        .filter((entry) => entry.stage === stage)
        .reduce((sum, entry) => sum + entry.count, 0),
      x,
      y,
      width: stageNodeWidth,
      height: totalWidth,
      fill: stageFill[stage]
    });

    previousStageBottom = y + totalWidth;
  }

  const activeStageIncomingWidth = stageOrder.reduce(
    (sum, stage) => sum + (stageOutcomeWidths.get(`${stage}:active`) ?? 0),
    0
  );
  const rejectedStageIncomingWidth = stageOrder.reduce(
    (sum, stage) => sum + (stageOutcomeWidths.get(`${stage}:rejected`) ?? 0),
    0
  );

  const rejectedHeight = directRejectedWidth + rejectedStageIncomingWidth;
  const activeHeight = directActiveWidth + activeStageIncomingWidth;
  const rejectedY = rootY + 20;
  const directActiveTop = rootSegmentTop.get("direct:active") ?? rootY + 160;
  const idealActiveY =
    directActiveWidth > 0
      ? directActiveTop + Math.max(0, (directActiveWidth - activeHeight) / 2)
      : rootY + rootHeight - activeHeight - 60;
  const activeY = Math.max(rejectedY + rejectedHeight + 118, idealActiveY);

  const outcomeNodes: ChartNode[] = [
    rejectedHeight > 0
      ? {
          id: "outcome:rejected",
          label: outcomeLabels.rejected,
          count: data.rejectedCount,
          x: 1140,
          y: rejectedY,
          width: 24,
          height: rejectedHeight,
          fill: outcomeFill.rejected
        }
      : null,
    activeHeight > 0
      ? {
          id: "outcome:active",
          label: outcomeLabels.active,
          count: data.activeCount,
          x: 1140,
          y: activeY,
          width: 24,
          height: activeHeight,
          fill: outcomeFill.active
        }
      : null
  ].filter((node): node is ChartNode => Boolean(node));

  const outcomeByPool = new Map<JobPool, ChartNode>(
    outcomeNodes.map((node) => [
      node.id.endsWith("active") ? "active" : "rejected",
      node
    ])
  );

  const outcomeCursor = new Map<JobPool, number>([
    ["rejected", rejectedY],
    ["active", activeY]
  ]);
  const links: ChartLink[] = [];

  if (directRejectedWidth > 0) {
    const targetNode = outcomeByPool.get("rejected");
    const targetTop = outcomeCursor.get("rejected") ?? rejectedY;
    if (targetNode) {
      links.push({
        id: "applications-to-rejected",
        kind: "root-to-outcome",
        count: appliedRejectedCount,
        width: directRejectedWidth,
        stroke: directOutcomeStroke.rejected,
        path: buildFlowPath(
          rootNode.x + rootNode.width,
          (rootSegmentTop.get("direct:rejected") ?? rootInnerTop) + directRejectedWidth / 2,
          targetNode.x,
          targetTop + directRejectedWidth / 2
        )
      });
      outcomeCursor.set("rejected", targetTop + directRejectedWidth);
    }
  }

  if (directActiveWidth > 0) {
    const targetNode = outcomeByPool.get("active");
    const targetTop = outcomeCursor.get("active") ?? activeY;
    if (targetNode) {
      links.push({
        id: "applications-to-active",
        kind: "root-to-outcome",
        count: appliedActiveCount,
        width: directActiveWidth,
        stroke: directOutcomeStroke.active,
        path: buildFlowPath(
          rootNode.x + rootNode.width,
          (rootSegmentTop.get("direct:active") ?? rootInnerTop) + directActiveWidth / 2,
          targetNode.x,
          targetTop + directActiveWidth / 2
        )
      });
      outcomeCursor.set("active", targetTop + directActiveWidth);
    }
  }

  for (const stage of visibleStages) {
    const stageNode = stageNodes.find((node) => node.id === `stage:${stage}`);
    const stageTop = rootSegmentTop.get(`stage:${stage}`) ?? rootInnerTop;
    const totalWidth = stageTotals.get(stage) ?? 0;
    if (!stageNode || totalWidth <= 0) {
      continue;
    }

    links.push({
      id: `applications-to-${stage}`,
      kind: "root-to-stage",
      count: stagedLinks
        .filter((entry) => entry.stage === stage)
        .reduce((sum, entry) => sum + entry.count, 0),
      width: totalWidth,
      stroke: `${stageFill[stage]}AA`,
      path: buildFlowPath(
        rootNode.x + rootNode.width,
        stageTop + totalWidth / 2,
        stageNode.x,
        stageNode.y + totalWidth / 2
      )
    });

    let stageCursor = stageNode.y;
    for (const pool of ["rejected", "active"] as const) {
      const outcomeNode = outcomeByPool.get(pool);
      const branchWidth = stageOutcomeWidths.get(`${stage}:${pool}`) ?? 0;
      if (!outcomeNode || branchWidth <= 0) {
        continue;
      }

      const targetTop = outcomeCursor.get(pool) ?? outcomeNode.y;
      const branch: FlowBranch = {
        id: `${stage}-to-${pool}`,
        stage,
        pool,
        count:
          stagedLinks.find((entry) => entry.stage === stage && entry.pool === pool)?.count ?? 0
      };

      links.push({
        id: branch.id,
        kind: "stage-to-outcome",
        count: branch.count,
        width: branchWidth,
        stroke: outcomeBranchStroke[pool],
        path: buildFlowPath(
          stageNode.x + stageNode.width,
          stageCursor + branchWidth / 2,
          outcomeNode.x,
          targetTop + branchWidth / 2
        ),
        branch
      });

      stageCursor += branchWidth;
      outcomeCursor.set(pool, targetTop + branchWidth);
    }
  }

  const height = Math.max(
    620,
    rootNode.y + rootNode.height + 90,
    ...stageNodes.map((node) => node.y + node.height + 90),
    ...outcomeNodes.map((node) => node.y + node.height + 90)
  );

  return {
    width,
    height,
    progressedCount,
    appliedActiveCount,
    appliedRejectedCount,
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
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const selectedBranch =
    layout?.links.find((link) => link.branch?.id === selectedBranchId)?.branch ?? null;
  const branchRecords = selectedBranch ? filterBranchRecords(selectedBranch, data.records) : [];

  if (data.totalRecords === 0) {
    return (
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Application Flow
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">No records yet</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Save a few applications first. The flow view will start charting them once records
          exist.
        </p>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
      <Surface className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Application Flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Sankey overview</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              All applications are counted here. Direct flows from Applications to Active or
              Rejected represent records still at the applied stage, while later-stage branches
              show records that moved beyond applied and their current outcome.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              All applications {data.totalRecords}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Applied-only active {layout.appliedActiveCount}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Applied-only rejected {layout.appliedRejectedCount}
            </span>
            <span className="rounded-full border border-border bg-white/80 px-3 py-1">
              Beyond applied {layout.progressedCount}
            </span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[32px] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(249,247,250,0.97))] p-6">
          <svg
            aria-label="Application flow sankey chart"
            className="h-auto min-w-[1180px] w-full"
            role="img"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {layout.links.map((link) => {
              const selected = selectedBranchId === link.branch?.id;

              if (!link.branch) {
                return (
                  <path
                    key={link.id}
                    d={link.path}
                    fill="none"
                    opacity={0.88}
                    stroke={link.stroke}
                    strokeWidth={link.width}
                  />
                );
              }

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
              opacity={0.97}
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
                  opacity={0.94}
                  rx={10}
                  width={node.width}
                  x={node.x}
                  y={node.y}
                />
                <text
                  className="fill-foreground"
                  fontSize="22"
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
                  opacity={0.97}
                  rx={10}
                  width={node.width}
                  x={node.x}
                  y={node.y}
                />
                <text
                  className="fill-foreground"
                  fontSize="24"
                  fontWeight="600"
                  x={node.x + node.width + 16}
                  y={node.y + 18}
                >
                  {node.count}
                </text>
                <text
                  className="fill-muted-foreground"
                  fontSize="14"
                  x={node.x + node.width + 16}
                  y={node.y + 38}
                >
                  {node.label}
                </text>
              </g>
            ))}

            <g>
              <text
                className="fill-foreground"
                fontSize="36"
                fontWeight="600"
                textAnchor="end"
                x={layout.rootNode.x - 22}
                y={layout.rootNode.y + layout.rootNode.height / 2 - 6}
              >
                {layout.rootNode.count}
              </text>
              <text
                className="fill-muted-foreground"
                fontSize="15"
                textAnchor="end"
                x={layout.rootNode.x - 22}
                y={layout.rootNode.y + layout.rootNode.height / 2 + 18}
              >
                Applications
              </text>
            </g>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click a later-stage result branch to inspect concrete records. Applied-only direct
          flows stay visible for context, but do not open record details.
        </p>
      </Surface>

      {selectedBranch ? (
        <Surface className="p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Branch Records
          </p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            {getBranchLabel(selectedBranch)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {branchRecords.length} record{branchRecords.length === 1 ? "" : "s"} in this
            branch. Active records open their existing detail page; Rejected records stay
            read-only here.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
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
        </Surface>
      ) : null}
    </div>
  );
}
