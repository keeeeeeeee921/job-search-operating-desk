import Image from "next/image";
import { Link2, FileText } from "lucide-react";
import { DesignLabSection } from "@/components/design-lab/design-lab-section";
import { DailyGoalsSnapshot } from "@/components/design-lab/daily-goals-snapshot";
import { JobRecordTable } from "@/components/job-record-table";
import { Surface } from "@/components/ui/surface";
import type { DailyGoalsState, JobListItem } from "@/lib/types";

function CurrentHomeSnapshot({
  recentItems,
  goals
}: {
  recentItems: JobListItem[];
  goals: DailyGoalsState;
}) {
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Surface className="p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Main Input
          </p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
            <div className="max-w-[980px] flex-1">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground xl:text-[3.35rem] xl:leading-[1.02]">
                Paste a job link. Keep the working pool honest.
              </h1>
            </div>
            <div className="flex justify-center lg:shrink-0 lg:justify-start">
              <Image
                alt="A bear sitting in an office chair surrounded by paper stacks."
                className="h-auto w-20 object-contain sm:w-24 lg:w-28"
                height={128}
                src="/pool-honest-bear.gif"
                unoptimized
                width={128}
              />
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            This desk separates input, extraction, and saved records. If required fields are missing or the source is restricted, the app stops and asks for review instead of pretending extraction succeeded.
          </p>
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center justify-center rounded-2xl border border-accent/20 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-soft">
                Paste link
              </span>
              <span className="inline-flex items-center justify-center rounded-2xl border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-muted-foreground">
                Paste job text
              </span>
            </div>
            <div className="rounded-[30px] border border-border bg-white px-4 py-4 shadow-lift">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Link2 className="size-5" />
                </div>
                <div className="flex-1 rounded-2xl px-0 py-2 text-base text-muted-foreground">
                  Paste a job link and press Enter
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="p-6">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Active Pool
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              Current working set
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Recent Active records, kept clean, quiet, and easy to scan.
            </p>
          </div>
          <JobRecordTable
            detailBasePath="/active"
            emptyDescription="Saved records will appear here after they are confirmed and added to Active."
            emptyTitle="No Active records yet"
            records={recentItems}
          />
        </Surface>
      </div>
      <div>
        <DailyGoalsSnapshot goals={goals} variant="current" />
      </div>
    </div>
  );
}

function RefinedWorkingSet({ records }: { records: JobListItem[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-[26px] border border-dashed border-border bg-white/70 px-6 py-10 text-center">
        <p className="text-base font-semibold text-foreground">No Active records yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Saved records will appear here after they are confirmed and added to Active.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-white/84 shadow-soft">
      {records.map((record, index) => (
        <div
          className="grid gap-4 px-5 py-4 xl:grid-cols-[1.3fr_0.9fr_0.85fr_1.45fr]"
          key={record.id}
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Role Title
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">{record.roleTitle}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {record.sourceType === "unknown"
                ? "Source not confirmed"
                : `${record.extractionStatus === "needs_review" ? "Reviewed manually" : "Confirmed"} · ${record.sourceType}`}
            </p>
          </div>
          <div className="xl:border-l xl:border-border/60 xl:pl-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Company
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{record.company}</p>
            <p className="mt-3 text-xs text-muted-foreground">{record.link ? "Link saved" : "Link not saved"}</p>
          </div>
          <div className="xl:border-l xl:border-border/60 xl:pl-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Location
            </p>
            <p className="mt-2 text-sm text-foreground">{record.location}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Saved {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(record.timestamp))}
            </p>
          </div>
          <div className="xl:border-l xl:border-border/60 xl:pl-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Job Description
            </p>
            <p className="mt-2 line-clamp-3 max-w-[60ch] text-sm leading-6 text-muted-foreground">
              {record.jobDescriptionPreview}
            </p>
          </div>
          {index < records.length - 1 ? (
            <div className="col-span-full h-px bg-border/65" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RefinedHomeSnapshot({
  recentItems,
  goals
}: {
  recentItems: JobListItem[];
  goals: DailyGoalsState;
}) {
  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_304px]">
      <div className="space-y-5">
        <Surface className="overflow-hidden px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[860px]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Main Input
              </p>
              <h1 className="mt-3 max-w-[13ch] text-[3.15rem] font-semibold leading-[0.98] tracking-tight text-foreground">
                Paste a job link. Keep the working pool honest.
              </h1>
              <p className="mt-4 max-w-[60ch] text-sm leading-6 text-muted-foreground">
                Separate intake, extraction, and saved records. If a field is incomplete or the source is restricted, the desk pauses for review instead of pretending certainty.
              </p>
            </div>
            <div className="flex justify-end lg:pt-1">
              <Image
                alt="A bear sitting in an office chair surrounded by paper stacks."
                className="h-auto w-16 object-contain sm:w-20"
                height={96}
                src="/pool-honest-bear.gif"
                unoptimized
                width={96}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-soft">
              Paste link
            </span>
            <span className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm text-muted-foreground">
              Paste job text
            </span>
          </div>
          <div className="mt-4 rounded-[28px] border border-border/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,246,251,0.92))] px-4 py-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                <Link2 className="size-4.5" />
              </div>
              <div className="flex-1 text-[15px] text-muted-foreground">
                Paste a job link and press Enter
              </div>
              <span className="hidden rounded-full border border-border/80 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:inline-flex">
                Command input
              </span>
            </div>
          </div>
        </Surface>

        <Surface className="px-6 py-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Active Pool
              </p>
              <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-foreground">
                Current working set
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Recent confirmed records, shown as one quiet working surface instead of repeated card blocks.
            </p>
          </div>
          <RefinedWorkingSet records={recentItems} />
        </Surface>
      </div>
      <div>
        <DailyGoalsSnapshot goals={goals} variant="refined" />
      </div>
    </div>
  );
}

export function DesignLabHome({
  recentItems,
  goals
}: {
  recentItems: JobListItem[];
  goals: DailyGoalsState;
}) {
  return (
    <div className="space-y-8">
      <DesignLabSection
        notes={[
          "Current homepage spacing",
          "Separate row-card working set",
          "Original widget rhythm"
        ]}
        title="Home"
        variant="current"
      >
        <CurrentHomeSnapshot goals={goals} recentItems={recentItems} />
      </DesignLabSection>

      <DesignLabSection
        notes={[
          "Tighter hero spacing",
          "Smaller illustration",
          "More unified working-set panel",
          "Less repeated card weight"
        ]}
        title="Home"
        variant="refined"
      >
        <RefinedHomeSnapshot goals={goals} recentItems={recentItems} />
      </DesignLabSection>
    </div>
  );
}
