import Image from "next/image";
import { Surface } from "@/components/ui/surface";
import { searchLogCycles } from "@/lib/search-cycle";

export function SearchLogPage() {
  const searchCycle = searchLogCycles[0];

  if (!searchCycle) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Surface className="border-white/60 bg-white/75 p-6">
        <div className="flex flex-col gap-4">
          <div className="max-w-3xl">
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
          <div className="w-fit rounded-3xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-muted-foreground shadow-soft">
            One search at a time.
            <br />
            Add the next one when a new search starts.
          </div>
        </div>
      </Surface>

      <Surface className="border-white/60 bg-white/75 p-5 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {searchCycle.label}
            </p>
            <h2 className="mt-2 max-w-xl text-2xl font-semibold text-foreground">
              {searchCycle.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{searchCycle.period}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
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
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {searchCycle.note}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/60 pt-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Companies I Interviewed With
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm leading-6 text-foreground">
            {searchCycle.interviewedCompanies.map((company) => (
              <li
                key={company}
                className="rounded-full border border-white/70 bg-white/90 px-3 py-1 shadow-soft"
              >
                {company}
              </li>
            ))}
          </ul>
        </div>
      </Surface>

      <Surface className="border-white/60 bg-white/75 p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Snapshot
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Search 01 snapshot
        </h2>
        <div className="mt-5 overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-soft">
          <Image
            alt={searchCycle.imageAlt}
            className="h-auto w-full"
            height={1000}
            priority
            src={searchCycle.imageSrc}
            width={2000}
          />
        </div>
      </Surface>
    </div>
  );
}
