import Image from "next/image";
import type { ReactNode } from "react";
import { SearchLogSankey } from "@/components/search-log-sankey";
import { Surface } from "@/components/ui/surface";
import { jobStageLabels } from "@/lib/job-stage";
import {
  formatSearchCyclePeriod,
  sortSearchCyclesByStart
} from "@/lib/search-cycle";
import { buildSearchLogFlow } from "@/lib/search-log-flow";
import type {
  InterviewedCompany,
  SearchCycle,
  SearchLogAnalytics
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

function cycleSlug(label: string) {
  return label.replace(/\s+/g, "-").toLowerCase();
}

function hasStory(cycle: SearchCycle) {
  return Boolean(cycle.title.trim() || cycle.note.trim() || cycle.goals.length > 0);
}

function InterviewedCompanies({ companies }: { companies: InterviewedCompany[] }) {
  if (companies.length === 0) {
    return (
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        No application in this cycle has reached Screening / OA yet. Set a stage
        on an Active record and it shows up here.
      </p>
    );
  }

  return (
    <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((entry) => (
        <li key={entry.company}>
          <span className="text-foreground">{entry.company}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, furthest stage </span>
          {jobStageLabels[entry.stage]}
        </li>
      ))}
    </ul>
  );
}

export function SearchCycleStory({
  cycle,
  interviewedCompanies,
  actions
}: {
  cycle: SearchCycle;
  interviewedCompanies: InterviewedCompany[];
  /** Edit controls rendered beside the heading (none for read-only views). */
  actions?: ReactNode;
}) {
  const headingId = `search-log-story-${cycleSlug(cycle.label)}`;
  const period = formatSearchCyclePeriod(cycle);
  const saved = hasStory(cycle);

  // Not a landmark region: the Sankey rows above already own the
  // "<label>" region names, and tests address stories by test id.
  return (
    <Surface className="p-5 lg:p-6" data-testid={`search-cycle-story-${cycleSlug(cycle.label)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Saved story</p>
          <h2
            className="mt-2 max-w-3xl text-2xl font-semibold text-foreground"
            id={headingId}
          >
            {cycle.title.trim() ? `${cycle.label}: ${cycle.title.trim()}` : cycle.label}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{period}</p>
          {actions}
        </div>
      </div>

      {saved ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-sm font-semibold text-foreground">Main goals</p>
            {cycle.goals.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground marker:text-accent">
                {cycle.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                No goals written down.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Approach</p>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {cycle.note.trim() || "No approach written down."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-6">
          <p className="text-base font-semibold text-foreground">
            No story written for {cycle.label} yet
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The funnel above already counts this cycle. Add a title, the goals
            and a note on the approach once the search has a shape.
          </p>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm font-semibold text-foreground">
          Companies I interviewed with
        </p>
        <InterviewedCompanies companies={interviewedCompanies} />
      </div>

      {cycle.imageSrc ? (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-xl font-semibold text-foreground">
            {cycle.label} snapshot
          </h3>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
            <Image
              alt={`${cycle.label} summary image, ${period}`}
              className="h-auto w-full"
              height={1000}
              sizes="(min-width: 1400px) 1320px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
              src={cycle.imageSrc}
              width={2000}
            />
          </div>
          {cycle.updatedAt ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Story updated {formatDate(cycle.updatedAt)}
            </p>
          ) : null}
        </div>
      ) : null}
    </Surface>
  );
}

export function SearchLogPage({
  analytics,
  cycles,
  storyActions,
  headerActions
}: {
  analytics: SearchLogAnalytics;
  cycles: SearchCycle[];
  /** Per-cycle edit controls; omitted for read-only renders. */
  storyActions?: (cycle: SearchCycle) => ReactNode;
  /** Controls above the saved stories, e.g. "Start a new search cycle". */
  headerActions?: ReactNode;
}) {
  const flows = analytics.cycles.map((cycle) => ({
    cycle,
    flow: buildSearchLogFlow(cycle)
  }));
  const periodByLabel = new Map(
    cycles.map((cycle) => [cycle.label, formatSearchCyclePeriod(cycle)])
  );
  const interviewedByLabel = new Map(
    analytics.cycles.map((cycle) => [cycle.label, cycle.interviewedCompanies])
  );
  const stories = sortSearchCyclesByStart(cycles);

  return (
    <div className="space-y-8">
      <div className="px-1">
        <p className="text-sm font-semibold text-accent">Search Log</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          Saved snapshots of each job search
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Completed searches live here as a short note plus one summary image.
        </p>
      </div>

      <Surface className="p-5 lg:p-6">
        <div>
          <p className="text-sm font-semibold text-accent">Flow overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            Application flow by search cycle
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each cycle is drawn to scale. Click the Screening / OA node, or the
            Interviewed button, to zoom into the people who reached an interview.
          </p>
        </div>

        <div className="mt-6 grid gap-5 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map(({ cycle }) => (
            <div key={cycle.label}>
              <p className="text-sm text-muted-foreground">Applications in {cycle.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                {cycle.total.toLocaleString("en-US")}
              </p>
            </div>
          ))}
          <div>
            <p className="text-sm text-muted-foreground">Legacy active records</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
              {analytics.sunkenActiveCount.toLocaleString("en-US")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved before {formatDate(analytics.sunkenThresholdDate)}
            </p>
          </div>
        </div>

        {flows.length > 0 ? (
          <div className="divide-y divide-border">
            {flows.map(({ cycle, flow }) => (
              <section
                aria-labelledby={`search-log-row-${cycleSlug(cycle.label)}`}
                className="py-6"
                key={cycle.label}
              >
                <SearchLogSankey
                  flow={flow}
                  heading={
                    <div>
                      <h3
                        className="text-lg font-semibold text-foreground"
                        id={`search-log-row-${cycleSlug(cycle.label)}`}
                      >
                        {cycle.label}
                      </h3>
                      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {periodByLabel.get(cycle.label) ?? "Period not saved"} ·{" "}
                        {cycle.total.toLocaleString("en-US")} applications ·{" "}
                        {flow.counts.screening.toLocaleString("en-US")} reached Screening
                        / OA
                      </p>
                    </div>
                  }
                />
              </section>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-base font-semibold text-foreground">No flow data yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Save records with a search cycle label to populate this chart.
            </p>
          </div>
        )}
      </Surface>

      {headerActions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-sm text-muted-foreground">
            New records go to the cycle with the latest start date.
          </p>
          {headerActions}
        </div>
      ) : null}

      {stories.map((cycle) => (
        <SearchCycleStory
          actions={storyActions?.(cycle)}
          cycle={cycle}
          interviewedCompanies={interviewedByLabel.get(cycle.label) ?? []}
          key={cycle.id}
        />
      ))}
    </div>
  );
}
