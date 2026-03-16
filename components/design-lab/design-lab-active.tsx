import Link from "next/link";
import { Search } from "lucide-react";
import { DesignLabSection } from "@/components/design-lab/design-lab-section";
import { JobRecordTable } from "@/components/job-record-table";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import type { JobListItem, PaginatedJobListResult } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function buildDesignLabHref(page: number, query: string) {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const serialized = params.toString();
  return serialized ? `/design-lab/active?${serialized}` : "/design-lab/active";
}

function CurrentActiveSnapshot({
  pageData,
  query
}: {
  pageData: PaginatedJobListResult;
  query: string;
}) {
  return (
    <div className="space-y-6 p-6">
      <Surface className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Search
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Active</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This is the active-only working pool. It stays focused on current applications, sorted by newest first.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {(pageData.page - 1) * pageData.pageSize + 1}-
            {Math.min(pageData.totalCount, pageData.page * pageData.pageSize)} of {pageData.totalCount}
          </div>
        </div>
        <form action="/design-lab/active" className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <Input
            autoFocus
            defaultValue={query}
            name="q"
            placeholder="Search Active records by company or role"
          />
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-accent/20 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            type="submit"
          >
            Search
          </button>
        </form>
      </Surface>
      <JobRecordTable
        detailBasePath="/active"
        emptyDescription="Try another company or role title. Search only scans Active records."
        emptyTitle="No matching Active records"
        records={pageData.records.slice(0, 5)}
      />
    </div>
  );
}

function RefinedActiveRows({ records }: { records: JobListItem[] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-white/88 shadow-soft">
      {records.map((record, index) => (
        <div className="grid gap-3 px-5 py-4 xl:grid-cols-[1.45fr_0.95fr_0.9fr_1.4fr]" key={record.id}>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Role Title
            </p>
            <Link className="mt-2 inline-block text-base font-semibold text-foreground transition hover:text-accent" href={`/active/${record.id}`}>
              {record.roleTitle}
            </Link>
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
            <p className="mt-3 text-xs text-muted-foreground">Saved {formatDate(record.timestamp)}</p>
          </div>
          <div className="xl:border-l xl:border-border/60 xl:pl-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Job Description
            </p>
            <p className="mt-2 line-clamp-3 max-w-[62ch] text-sm leading-6 text-muted-foreground">
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

function RefinedActiveSnapshot({
  pageData,
  query
}: {
  pageData: PaginatedJobListResult;
  query: string;
}) {
  const rangeStart = pageData.totalCount === 0 ? 0 : (pageData.page - 1) * pageData.pageSize + 1;
  const rangeEnd = Math.min(pageData.totalCount, pageData.page * pageData.pageSize);

  return (
    <div className="space-y-5 p-5">
      <Surface className="px-6 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Working Pool
              </p>
              <h1 className="mt-2 text-[2.15rem] font-semibold tracking-tight text-foreground">
                Active
              </h1>
              <p className="mt-3 max-w-[62ch] text-sm leading-6 text-muted-foreground">
                The same Active records, reorganized into a denser search header and a quieter, more list-like working table.
              </p>
            </div>
            <div className="rounded-full border border-border/80 bg-background/85 px-4 py-2 text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {pageData.totalCount}
            </div>
          </div>

          <form action="/design-lab/active" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-3 rounded-[24px] border border-border/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,246,251,0.92))] px-4 py-3 shadow-soft">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                <Search className="size-4.5" />
              </div>
              <Input
                className="border-none bg-transparent px-0 py-1.5 text-[15px] shadow-none focus:ring-0"
                defaultValue={query}
                name="q"
                placeholder="Search Active by company or role"
              />
            </div>
            <button
              className="inline-flex items-center justify-center rounded-[24px] border border-accent/20 bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              type="submit"
            >
              Search
            </button>
          </form>
        </div>
      </Surface>

      <RefinedActiveRows records={pageData.records.slice(0, 5)} />

      {pageData.totalPages > 1 ? (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span>
            Previewing the first 5 records from page {pageData.page}
          </span>
          <div className="flex gap-2">
            {pageData.hasPreviousPage ? (
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-transparent bg-transparent px-4 py-2 font-semibold text-muted-foreground transition hover:bg-surface hover:text-foreground"
                href={buildDesignLabHref(pageData.page - 1, query)}
              >
                Previous
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-transparent px-4 py-2 font-semibold text-muted-foreground/60">
                Previous
              </span>
            )}
            {pageData.hasNextPage ? (
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-white/80 px-4 py-2 font-semibold text-foreground transition hover:border-accent/20 hover:bg-white"
                href={buildDesignLabHref(pageData.page + 1, query)}
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-border px-4 py-2 font-semibold text-muted-foreground/60">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DesignLabActive({
  pageData,
  query
}: {
  pageData: PaginatedJobListResult;
  query: string;
}) {
  return (
    <div className="space-y-8">
      <DesignLabSection
        notes={[
          "Original search header",
          "Current list card rhythm",
          "Current spacing density"
        ]}
        title="Active"
        variant="current"
      >
        <CurrentActiveSnapshot pageData={pageData} query={query} />
      </DesignLabSection>

      <DesignLabSection
        notes={[
          "Tighter search bar",
          "Range closer to controls",
          "More list-like rows",
          "Lower link noise"
        ]}
        title="Active"
        variant="refined"
      >
        <RefinedActiveSnapshot pageData={pageData} query={query} />
      </DesignLabSection>
    </div>
  );
}
