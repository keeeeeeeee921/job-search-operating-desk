"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import type {
  SearchLogFlow,
  SearchLogFlowColor,
  SearchLogFlowNode,
  SearchLogFlowNodeId
} from "@/lib/search-log-flow";
import { cn } from "@/lib/utils";

/*
 * One chart, two states (focus + context drill-down).
 *
 * Overview scales every band by the applications in the cycle, so the
 * interviewed subset is drawn honestly as a hairline. Focus rescales the same
 * geometry to the people who reached Screening / OA and parks the Rejected /
 * No Response bands as 2px stubs along the bottom edge. The two layouts share
 * node order and x positions, so the transition is a plain tween.
 */

const WIDTH = 980;
const HEIGHT = 300;
const NODE_WIDTH = 14;
const LEFT = 100;
const RIGHT = 150;
const TOP = 4;
const BOTTOM = 4;
const PAD = 12;
const STUB = 2;
const MIN_LINK = 1.5;
const LABEL_BLOCK = 26;
const LABEL_MIN_HEIGHT = 10;
const COLUMNS = 4;
const DURATION_MS = 450;

const linkFill: Record<SearchLogFlowColor, string> = {
  screening: "var(--stage-screening)",
  round1: "var(--stage-round1)",
  round2: "var(--stage-round2)",
  offer: "var(--stage-offer)",
  rejected: "var(--stage-rejected)",
  no_response: "var(--stage-no-response)"
};

const foreground = "hsl(var(--foreground))";
const mutedForeground = "hsl(var(--muted-foreground))";
const surface = "hsl(var(--surface))";
const muted = "hsl(var(--muted))";

type NodeFrame = { y: number; h: number; show: boolean };
type LinkFrame = { y0: number; y1: number; w: number };
type Frame = {
  nodes: Record<SearchLogFlowNodeId, NodeFrame>;
  links: LinkFrame[];
  /** Which denominator the percentages use at this moment. */
  focus: boolean;
};

function nodeX(column: number) {
  return LEFT + ((WIDTH - LEFT - RIGHT - NODE_WIDTH) * column) / COLUMNS;
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number | null) {
  return value === null ? "0%" : `${value}%`;
}

function stack(flow: SearchLogFlow, focus: boolean, k: number): Frame {
  const widths = flow.links.map((link) => {
    if (link.value === 0) {
      return 0;
    }
    if (focus && link.context) {
      return STUB;
    }
    return Math.max(link.value * k, MIN_LINK);
  });

  const inbound = new Map<SearchLogFlowNodeId, number>();
  const outbound = new Map<SearchLogFlowNodeId, number>();
  flow.links.forEach((link, index) => {
    outbound.set(link.source, (outbound.get(link.source) ?? 0) + widths[index]);
    inbound.set(link.target, (inbound.get(link.target) ?? 0) + widths[index]);
  });

  const nodes = {} as Record<SearchLogFlowNodeId, NodeFrame>;
  const columns = new Map<number, SearchLogFlowNode[]>();
  for (const node of flow.nodes) {
    const list = columns.get(node.column) ?? [];
    list.push(node);
    columns.set(node.column, list);
  }

  for (const list of columns.values()) {
    let y = TOP;
    for (const node of list) {
      const h =
        node.value === 0
          ? 0
          : Math.max(inbound.get(node.id) ?? 0, outbound.get(node.id) ?? 0);
      const show =
        node.value > 0 &&
        (h >= LABEL_MIN_HEIGHT ||
          (node.column === 1 && !focus) ||
          (focus && !node.context));
      nodes[node.id] = { y, h, show };

      // Leave room under a short node for its two-line label.
      const advance = Math.max(h, show ? LABEL_BLOCK : 0);
      y += advance + (advance > 0 ? PAD : 0);
    }
  }

  if (focus) {
    // Context nodes sit on the bottom edge as reminders.
    let bottom = HEIGHT - STUB;
    for (const id of ["no_response", "rejected"] as const) {
      if (nodes[id].h > 0) {
        nodes[id].y = bottom;
        bottom -= STUB + 3;
      }
    }
    nodes.applied.y = TOP;
    nodes.screening.y = TOP;
  }

  const sourceOffset = new Map<SearchLogFlowNodeId, number>();
  const targetOffset = new Map<SearchLogFlowNodeId, number>();
  const links = flow.links.map((link, index) => {
    const w = widths[index];
    const y0 = nodes[link.source].y + (sourceOffset.get(link.source) ?? 0);
    const y1 = nodes[link.target].y + (targetOffset.get(link.target) ?? 0);
    sourceOffset.set(link.source, (sourceOffset.get(link.source) ?? 0) + w);
    targetOffset.set(link.target, (targetOffset.get(link.target) ?? 0) + w);
    return { y0, y1, w };
  });

  return { nodes, links, focus };
}

/** Bottom edge of the tallest stacked column, label blocks included. */
function tallestColumn(flow: SearchLogFlow, frame: Frame) {
  let extent = 0;
  let heights = 0;
  for (const column of [0, 1, 2, 3, 4]) {
    let columnExtent = 0;
    let columnHeights = 0;
    for (const node of flow.nodes) {
      if (node.column !== column || (node.context && frame.focus)) {
        continue;
      }
      const { y, h, show } = frame.nodes[node.id];
      columnExtent = Math.max(columnExtent, y + Math.max(h, show ? LABEL_BLOCK : 0));
      columnHeights += h;
    }
    if (columnExtent > extent) {
      extent = columnExtent;
      heights = columnHeights;
    }
  }
  return { extent, heights };
}

export function layoutFlow(flow: SearchLogFlow, focus: boolean): Frame {
  const denominator = focus ? flow.counts.screening : flow.counts.applied;
  if (!(denominator > 0)) {
    return stack(flow, focus, 0);
  }

  // Start from the full height, then shrink the scale until the tallest
  // column (bands + padding + label blocks) fits inside the chart.
  let k = (HEIGHT - TOP - BOTTOM - PAD * 2) / denominator;
  let frame = stack(flow, focus, k);
  for (let pass = 0; pass < 6; pass += 1) {
    const { extent, heights } = tallestColumn(flow, frame);
    if (extent <= HEIGHT - BOTTOM || heights <= 0) {
      break;
    }
    const fixed = extent - heights;
    k *= Math.max(0.1, (HEIGHT - BOTTOM - fixed) / heights);
    frame = stack(flow, focus, k);
  }
  return frame;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function interpolate(from: Frame, to: Frame, t: number): Frame {
  const e = easeInOutQuad(t);
  const pastHalf = t > 0.5;
  const nodes = {} as Record<SearchLogFlowNodeId, NodeFrame>;
  for (const id of Object.keys(from.nodes) as SearchLogFlowNodeId[]) {
    nodes[id] = {
      y: lerp(from.nodes[id].y, to.nodes[id].y, e),
      h: lerp(from.nodes[id].h, to.nodes[id].h, e),
      show: pastHalf ? to.nodes[id].show : from.nodes[id].show
    };
  }
  return {
    nodes,
    links: from.links.map((link, index) => ({
      y0: lerp(link.y0, to.links[index].y0, e),
      y1: lerp(link.y1, to.links[index].y1, e),
      w: lerp(link.w, to.links[index].w, e)
    })),
    focus: pastHalf ? to.focus : from.focus
  };
}

function linkPath(x1: number, x0: number, link: LinkFrame) {
  if (link.w <= 0) {
    return "";
  }
  const xm = (x1 + x0) / 2;
  const { y0, y1, w } = link;
  return [
    `M${x1},${y0}`,
    `C${xm},${y0} ${xm},${y1} ${x0},${y1}`,
    `L${x0},${y1 + w}`,
    `C${xm},${y1 + w} ${xm},${y0 + w} ${x1},${y0 + w}`,
    "Z"
  ].join(" ");
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SearchLogSankey({
  flow,
  heading,
  className
}: {
  flow: SearchLogFlow;
  /** Rendered on the left of the toolbar, opposite the All / Interviewed toggle. */
  heading?: ReactNode;
  className?: string;
}) {
  const { applied, screening } = flow.counts;
  const canFocus = screening > 0;
  const [focused, setFocused] = useState(false);
  // useId output carries ":" / "«»", which url(#...) references choke on.
  const labelBackdropId = `label-backdrop-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [frame, setFrame] = useState<Frame>(() => layoutFlow(flow, false));
  const frameRef = useRef(frame);
  const rafRef = useRef<number | null>(null);

  const commit = useCallback((next: Frame) => {
    frameRef.current = next;
    setFrame(next);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const setFocus = useCallback(
    (on: boolean) => {
      if (on === focused || (on && !canFocus)) {
        return;
      }
      setFocused(on);
      const target = layoutFlow(flow, on);
      const from = frameRef.current;

      if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
        commit(target);
        return;
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / DURATION_MS);
        commit(t < 1 ? interpolate(from, target, t) : target);
        rafRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [canFocus, commit, flow, focused]
  );

  const onScreeningKeyDown = (event: KeyboardEvent<SVGRectElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFocus(!focused);
    }
  };

  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  const screeningNode = nodeById.get("screening");

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{heading}</div>
        <div
          aria-label={`${flow.label} focus`}
          className="inline-flex shrink-0 gap-1 self-start rounded-full border border-border bg-muted p-1"
          role="group"
        >
          <button
            aria-pressed={!focused}
            className={cn(
              "min-h-9 rounded-full px-4 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              !focused
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setFocus(false)}
            type="button"
          >
            All {formatCount(applied)}
          </button>
          <button
            aria-pressed={focused}
            className={cn(
              "min-h-9 rounded-full px-4 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
              focused
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
            disabled={!canFocus}
            onClick={() => setFocus(true)}
            title={canFocus ? undefined : "No interview stages recorded yet"}
            type="button"
          >
            Interviewed {formatCount(screening)}
          </button>
        </div>
      </div>

      <div className="sm:hidden">
        <div className="divide-y divide-border border-y border-border">
          {flow.nodes
            .filter((node) => node.column > 0 && node.value > 0)
            .map((node) => (
              <div className="flex items-center justify-between gap-4 py-3" key={node.id}>
                <span className="text-sm text-muted-foreground">
                  {node.column > 1 && node.label === "Dropped"
                    ? `Dropped after ${node.column === 2 ? "Screening / OA" : node.column === 3 ? "Round 1" : "Round 2+"}`
                    : node.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCount(node.value)}
                  <span className="ml-2 font-medium text-muted-foreground">
                    {formatPercent(focused ? node.pctOfScreened : node.pctOfApplied)}
                  </span>
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-2xl bg-muted/25 sm:block">
        <svg
          aria-label={`${flow.label} application flow. ${
            canFocus
              ? "Click the Screening / OA node to focus on the interviewed subset."
              : "No interview stages recorded yet."
          }`}
          className="block h-auto w-full min-w-[840px]"
          role="group"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          <defs>
            {/* Labels sit where bands leave their node. Paint the chart's own
                background (surface + muted/25) behind each label block so it
                vanishes on empty canvas and masks the band underneath. */}
            <filter
              height="1.2"
              id={labelBackdropId}
              width="1.04"
              x="0"
              y="-0.1"
            >
              <feFlood floodColor={surface} result="surface" />
              <feFlood floodColor={muted} floodOpacity={0.25} result="muted" />
              <feMerge>
                <feMergeNode in="surface" />
                <feMergeNode in="muted" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g>
            {flow.links.map((link, index) => {
              const source = nodeById.get(link.source);
              const target = nodeById.get(link.target);
              if (!source || !target) {
                return null;
              }
              const share = frame.focus && !link.context ? screening : applied;
              return (
                <path
                  className="transition-opacity hover:opacity-95"
                  d={linkPath(nodeX(source.column) + NODE_WIDTH, nodeX(target.column), frame.links[index])}
                  key={`${link.source}-${link.target}`}
                  opacity={0.6}
                  style={{ fill: linkFill[link.color] }}
                >
                  <title>
                    {`${source.label} → ${target.label}: ${formatCount(link.value)} (${formatPercent(
                      share > 0 ? Math.round((link.value / share) * 1000) / 10 : null
                    )} of ${frame.focus && !link.context ? "interviewed" : "applied"})`}
                  </title>
                </path>
              );
            })}
          </g>

          <g>
            {flow.nodes.map((node) => {
              const position = frame.nodes[node.id];
              const x = nodeX(node.column);
              const height = Math.max(position.h, node.value > 0 ? 2 : 0);
              const isScreening = node.id === "screening";
              const interactive = isScreening && canFocus;
              const labelAnchor = node.column === 0 ? "end" : "start";
              const labelX = node.column === 0 ? x - 6 : x + NODE_WIDTH + 6;
              const blockTop =
                position.y + Math.max(0, (Math.min(position.h, 28) - LABEL_BLOCK) / 2);
              const useScreened = frame.focus && !node.context;
              const percent = useScreened ? node.pctOfScreened : node.pctOfApplied;

              return (
                <g key={node.id}>
                  <rect
                    aria-label={
                      interactive
                        ? `${node.label}: ${formatCount(node.value)}. ${
                            focused ? "Show all applications" : "Focus on these"
                          }`
                        : undefined
                    }
                    aria-pressed={interactive ? focused : undefined}
                    className={cn(
                      interactive &&
                        "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    )}
                    height={height}
                    onClick={interactive ? () => setFocus(!focused) : undefined}
                    onKeyDown={interactive ? onScreeningKeyDown : undefined}
                    role={interactive ? "button" : undefined}
                    rx={2}
                    style={{ fill: foreground }}
                    tabIndex={interactive ? 0 : undefined}
                    width={NODE_WIDTH}
                    x={x}
                    y={position.y}
                  >
                    <title>
                      {`${node.label}: ${formatCount(node.value)}${
                        interactive ? (focused ? " · click to show all" : " · click to focus") : ""
                      }`}
                    </title>
                  </rect>
                  {position.show ? (
                    <g
                      data-node-label={node.id}
                      filter={`url(#${labelBackdropId})`}
                    >
                      <text
                        fontSize={13}
                        fontWeight={700}
                        style={{ fill: foreground }}
                        textAnchor={labelAnchor}
                        x={labelX}
                        y={blockTop + 11}
                      >
                        <tspan>{formatCount(node.value)}</tspan>
                        {node.column > 0 ? (
                          <tspan dx={6} fontWeight={500} style={{ fill: mutedForeground }}>
                            {formatPercent(percent)}
                          </tspan>
                        ) : null}
                      </text>
                      <text
                        fontSize={12.5}
                        style={{ fill: foreground }}
                        textAnchor={labelAnchor}
                        x={labelX}
                        y={blockTop + 25}
                      >
                        {node.label}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </g>

        </svg>
      </div>
    </div>
  );
}
