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
import type { ApplicationFlowSankeyData, JobPool, SourceType } from "@/lib/types";

type SankeyColumn = "source" | "stage" | "outcome";

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
};

const sourceTypeLabels: Record<SourceType, string> = {
  linkedin: "LinkedIn",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  company: "Company site",
  unknown: "Source not confirmed"
};

const outcomeLabels: Record<JobPool, string> = {
  active: "Active",
  rejected: "Rejected"
};

const columnHeaders: Array<{ id: SankeyColumn; label: string }> = [
  { id: "source", label: "Source Type" },
  { id: "stage", label: "Highest Confirmed Stage" },
  { id: "outcome", label: "Current Outcome" }
];

function formatSourceTypeLabel(sourceType: SourceType) {
  return sourceTypeLabels[sourceType];
}

function buildSankeyGraph(data: ApplicationFlowSankeyData) {
  const nodes = new Map<string, FlowNode>();
  const sourceToStage = new Map<string, FlowLink>();
  const stageToPool = new Map<string, FlowLink>();

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

  for (const entry of data.links) {
    const sourceId = `source:${entry.sourceType}`;
    const stageId = `stage:${entry.stage}`;
    const outcomeId = `outcome:${entry.pool}`;

    ensureNode(sourceId, formatSourceTypeLabel(entry.sourceType), "source", "#cfc7ea");
    ensureNode(stageId, formatJobStageLabel(entry.stage), "stage", "#a89bcc");
    ensureNode(outcomeId, outcomeLabels[entry.pool], "outcome", "#d9d6e7");

    const sourceStageKey = `${sourceId}->${stageId}`;
    const stageOutcomeKey = `${stageId}->${outcomeId}`;

    const sourceStage = sourceToStage.get(sourceStageKey);
    if (sourceStage) {
      sourceStage.value += entry.count;
    } else {
      sourceToStage.set(sourceStageKey, {
        source: sourceId,
        target: stageId,
        value: entry.count,
        stroke: "rgba(153, 138, 200, 0.42)"
      });
    }

    const stageOutcome = stageToPool.get(stageOutcomeKey);
    if (stageOutcome) {
      stageOutcome.value += entry.count;
    } else {
      stageToPool.set(stageOutcomeKey, {
        source: stageId,
        target: outcomeId,
        value: entry.count,
        stroke: entry.pool === "active" ? "rgba(123, 105, 180, 0.48)" : "rgba(186, 124, 124, 0.38)"
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    links: [...sourceToStage.values(), ...stageToPool.values()]
  };
}

function layoutSankey(data: ApplicationFlowSankeyData) {
  const graph = buildSankeyGraph(data);
  const width = 1080;
  const height = Math.max(420, graph.nodes.length * 56);

  const generator = sankey<FlowNode, FlowLink>()
    .nodeId((node) => node.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(18)
    .nodePadding(18)
    .extent([
      [24, 24],
      [width - 24, height - 24]
    ]);

  const laidOut = generator({
    nodes: graph.nodes.map((node) => ({ ...node })),
    links: graph.links.map((link) => ({ ...link }))
  });

  return { width, height, graph: laidOut };
}

function renderLinkPath(graph: SankeyGraph<FlowNode, FlowLink>, index: number) {
  const link = graph.links[index];
  if (!link) {
    return null;
  }

  const path = sankeyLinkHorizontal<FlowNode, FlowLink>()(link);
  if (!path) {
    return null;
  }

  return (
    <path
      d={path}
      fill="none"
      key={`${link.index ?? index}-${index}`}
      opacity={0.9}
      stroke={link.stroke}
      strokeWidth={Math.max(1, link.width ?? 1)}
    />
  );
}

export function ApplicationFlowSankey({
  data
}: {
  data: ApplicationFlowSankeyData;
}) {
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
          Save a few applications first. The Sankey view will start charting source,
          stage, and current outcome once records exist.
        </p>
      </Surface>
    );
  }

  const { width, height, graph } = layoutSankey(data);

  return (
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
            This chart uses each record&apos;s current source type, highest confirmed stage,
            and current outcome. It is an honest overview of the records you have today,
            not a full historical event log.
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
          className="h-auto min-w-[960px] w-full"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {graph.links.map((_, index) => renderLinkPath(graph, index))}
          {graph.nodes.map((node, index) => (
            <g key={`${node.id}-${index}`}>
              <rect
                fill={node.fill}
                height={Math.max(12, (node.y1 ?? 0) - (node.y0 ?? 0))}
                opacity={0.95}
                rx={9}
                width={Math.max(12, (node.x1 ?? 0) - (node.x0 ?? 0))}
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
                y={Math.max(28, (node.y0 ?? 0) - 8 + 14)}
              >
                {node.value ?? 0}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Surface>
  );
}
