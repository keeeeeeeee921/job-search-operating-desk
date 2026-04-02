import Image from "next/image";
import { Surface } from "@/components/ui/surface";

const searchCycle = {
  label: "Search 01",
  period: "Dec 2025 - Mar 2026",
  title: "First full-time search after graduation",
  goals: ["Find a job", "Keep some data analysis content in the role"],
  note:
    "Because this was the first post-graduation search, the scope stayed intentionally broad. The priority was to land a solid full-time role, ideally with some analytics content, without over-optimizing for a perfect match.",
  imageSrc: "/job-search-cycle-01.png",
  imageAlt: "First job search cycle summary from December 2025 to March 2026"
} as const;

export function SearchLogPage() {
  return (
    <div className="space-y-8">
      <Surface className="border-white/60 bg-white/75 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Search Log
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Job search cycles, captured as fixed snapshots
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Each search cycle can live here as its own recorded run, with a short
              note on goals and one attached summary image.
            </p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-muted-foreground shadow-soft">
            One search cycle at a time.
            <br />
            Add the next one when a new job hunt begins.
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Surface className="h-fit border-white/60 bg-white/75 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {searchCycle.label}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            {searchCycle.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{searchCycle.period}</p>

          <div className="mt-5 space-y-5">
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
                Search stance
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {searchCycle.note}
              </p>
            </div>
          </div>
        </Surface>

        <Surface className="border-white/60 bg-white/75 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Snapshot
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            Search 01 summary image
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
    </div>
  );
}
