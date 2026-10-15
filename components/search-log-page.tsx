import Image from "next/image";
import { SearchLogSankey } from "@/components/search-log-sankey";
import { Surface } from "@/components/ui/surface";
import {
  SEARCH_02_START_INSTANT,
  getCurrentSearchCycleLabel,
  searchLogCycles
} from "@/lib/search-cycle";
import { buildSearchLogFlow } from "@/lib/search-log-flow";
import type { SearchLogAnalytics } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function cyclePeriod(label: string) {
  const story = searchLogCycles.find((cycle) => cycle.label === label);
  if (story) {
    return story.period.replace(" ~ ", " to ");
  }
  if (label === getCurrentSearchCycleLabel()) {
    return `Since ${formatDate(SEARCH_02_START_INSTANT.toISOString())}`;
  }
  return "Period not saved";
}

export function SearchLogPage({
  analytics
}: {
  analytics: SearchLogAnalytics;
}) {
  const flows = analytics.cycles.map((cycle) => ({
    cycle,
    flow: buildSearchLogFlow(cycle)
  }));

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
                aria-labelledby={`search-log-row-${cycle.label.replace(/\s+/g, "-").toLowerCase()}`}
                className="py-6"
                key={cycle.label}
              >
                <SearchLogSankey
                  flow={flow}
                  heading={
                    <div>
                      <h3
                        className="text-lg font-semibold text-foreground"
                        id={`search-log-row-${cycle.label.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        {cycle.label}
                      </h3>
                      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {cyclePeriod(cycle.label)} · {cycle.total.toLocaleString("en-US")}{" "}
                        applications · {flow.counts.screening.toLocaleString("en-US")} reached
                        Screening / OA
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

      {searchLogCycles.map((searchCycle) => (
        <Surface className="p-5 lg:p-6" key={searchCycle.label}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">Saved story</p>
              <h2 className="mt-2 max-w-3xl text-2xl font-semibold text-foreground">
                {searchCycle.label}: {searchCycle.title}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {searchCycle.period.replace(" ~ ", " to ")}
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-semibold text-foreground">Main goals</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground marker:text-accent">
                {searchCycle.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Approach</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {searchCycle.note}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-semibold text-foreground">
              Companies I interviewed with
            </p>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              {searchCycle.interviewedCompanies.map((company) => (
                <li key={company}>{company}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-xl font-semibold text-foreground">
              {searchCycle.label} snapshot
            </h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
              <Image
                alt={searchCycle.imageAlt}
                className="h-auto w-full"
                height={1000}
                sizes="(min-width: 1400px) 1320px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
                src={searchCycle.imageSrc}
                width={2000}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Updated May 21, 2026</p>
          </div>
        </Surface>
      ))}
    </div>
  );
}
