import Image from "next/image";
import { SearchLogSankey } from "@/components/search-log-sankey";
import { Surface } from "@/components/ui/surface";
import { searchLogCycles } from "@/lib/search-cycle";
import type { SearchLogAnalytics } from "@/lib/types";

export function SearchLogPage({
  analytics
}: {
  analytics: SearchLogAnalytics;
}) {
  const searchCycle = searchLogCycles[0];

  if (!searchCycle) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Surface className="border-white/60 bg-white/75 p-5 lg:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Search Log
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Saved snapshots of each job search
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Each search lives here as a short note plus one summary image.
          </p>
        </div>
      </Surface>

      <Surface className="border-white/60 bg-white/75 p-5 lg:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Live Sankey
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            Application flow by search cycle
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            This chart is generated from saved records, grouped by Search Cycle and current stage.
          </p>
        </div>
        <div className="mt-6">
          <SearchLogSankey analytics={analytics} />
        </div>
      </Surface>

      <Surface className="border-white/60 bg-white/75 p-5 lg:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {searchCycle.label}
        </p>
        <h2 className="mt-2 max-w-3xl text-2xl font-semibold text-foreground">
          {searchCycle.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{searchCycle.period}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Main goals
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
              {searchCycle.goals.map((goal) => (
                <li key={goal}>- {goal}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Approach
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {searchCycle.note}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-white/60 pt-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Companies I Interviewed With
          </p>
          <ul className="mt-3 flex flex-wrap gap-2.5 text-sm leading-6 text-foreground">
            {searchCycle.interviewedCompanies.map((company) => (
              <li
                key={company}
                className="rounded-2xl border border-black/5 bg-black/[0.025] px-2.5 py-0.5 text-[13px] text-foreground/78"
              >
                {company}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 border-t border-white/60 pt-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Snapshot
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-foreground">
            Search 01 snapshot
          </h3>
          <div className="relative mt-5 overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-soft">
            <Image
              alt={searchCycle.imageAlt}
              className="h-auto w-full"
              height={1000}
              priority
              src={searchCycle.imageSrc}
              width={2000}
            />
            <p className="absolute bottom-4 right-4 rounded-full bg-white/88 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
              Updated May 21, 2026
            </p>
          </div>
        </div>
      </Surface>
    </div>
  );
}
