import Link from "next/link";
import { JobRecordTable } from "@/components/job-record-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import type { PaginatedJobListResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export const OLDER_CYCLES_PARAM = "cycle";
export const OLDER_CYCLES_VALUE = "older";

/**
 * Describes the search-cycle split shown on /active: the current cycle is the
 * default working set, older cycles stay one click away.
 */
export type SearchCycleView = {
  mode: "current" | "older";
  currentLabel: string;
  currentCount: number;
  olderCount: number;
};

export function buildListHref(
  basePath: string,
  input: { page?: number; query?: string; olderCycles?: boolean }
) {
  const params = new URLSearchParams();

  if (input.olderCycles) {
    params.set(OLDER_CYCLES_PARAM, OLDER_CYCLES_VALUE);
  }

  if (input.query?.trim()) {
    params.set("q", input.query.trim());
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }

  const serialized = params.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

function CycleToggle({
  basePath,
  cycleView,
  query
}: {
  basePath: string;
  cycleView: SearchCycleView;
  query: string;
}) {
  const olderActive = cycleView.mode === "older";
  const optionClassName = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
      active
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-surface hover:text-foreground"
    );

  return (
    <nav
      aria-label="Search cycle"
      className="flex w-fit shrink-0 gap-1 rounded-full border border-border bg-muted p-1"
    >
      <Link
        aria-current={olderActive ? undefined : "page"}
        className={optionClassName(!olderActive)}
        href={buildListHref(basePath, { query })}
      >
        {cycleView.currentLabel} ({cycleView.currentCount})
      </Link>
      <Link
        aria-current={olderActive ? "page" : undefined}
        className={optionClassName(olderActive)}
        href={buildListHref(basePath, { query, olderCycles: true })}
      >
        Older cycles ({cycleView.olderCount})
      </Link>
    </nav>
  );
}

function formatRange(pageData: PaginatedJobListResult) {
  if (pageData.totalPages <= 1) {
    return `${pageData.totalCount} records`;
  }

  const start = (pageData.page - 1) * pageData.pageSize + 1;
  const end = Math.min(pageData.totalCount, pageData.page * pageData.pageSize);
  return `${start}-${end} of ${pageData.totalCount}`;
}

export function ListPageView({
  title,
  pageData,
  basePath,
  searchable = false,
  searchPlaceholder = "Search Active by company or role",
  detailBasePath,
  query = "",
  cycleView
}: {
  title: string;
  pageData: PaginatedJobListResult;
  basePath: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  detailBasePath?: string;
  query?: string;
  cycleView?: SearchCycleView;
}) {
  const olderCycles = cycleView?.mode === "older";
  const pageHref = (page: number) =>
    buildListHref(basePath, { page, query, olderCycles });

  const detailSearch = (() => {
    const href = buildListHref(basePath, { page: pageData.page, query, olderCycles });
    const index = href.indexOf("?");
    return index === -1 ? "" : href.slice(index);
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3 px-1">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
        <span className="text-sm tabular-nums text-muted-foreground">{formatRange(pageData)}</span>
      </div>

      {searchable || cycleView ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {searchable ? (
            <form action={basePath} className="flex w-full max-w-2xl gap-2">
              {olderCycles ? (
                <input name={OLDER_CYCLES_PARAM} type="hidden" value={OLDER_CYCLES_VALUE} />
              ) : null}
              <Input
                aria-label={searchPlaceholder}
                defaultValue={query}
                name="q"
                placeholder={searchPlaceholder}
              />
              <Button className="shrink-0" type="submit">Search</Button>
              {query ? (
                <Link
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200",
                    "border-transparent bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                  href={buildListHref(basePath, { olderCycles })}
                >
                  Clear
                </Link>
              ) : null}
            </form>
          ) : null}
          {cycleView ? (
            <CycleToggle basePath={basePath} cycleView={cycleView} query={query} />
          ) : null}
        </div>
      ) : null}

      <JobRecordTable
        detailBasePath={detailBasePath}
        detailSearch={detailSearch}
        emptyTitle={
          query
            ? `No matches in ${title}`
            : cycleView?.mode === "current"
              ? `No ${title} records in ${cycleView.currentLabel} yet`
              : searchable
                ? `No matches in ${title}`
                : "No records yet"
        }
        records={pageData.records}
      />

      {pageData.totalPages > 1 ? (
        <Surface className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="text-sm text-muted-foreground">
            Page {pageData.page} of {pageData.totalPages}
          </div>
          <div className="flex gap-2">
            {pageData.hasPreviousPage ? (
              <Link
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200",
                  "border-transparent bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
                href={pageHref(pageData.page - 1)}
              >
                Previous
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-transparent px-4 py-2 text-sm font-semibold text-muted-foreground/60">
                Previous
              </span>
            )}
            {pageData.hasNextPage ? (
              <Link
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200",
                  "border-border bg-surface text-foreground hover:border-accent/20 hover:bg-white"
                )}
                href={pageHref(pageData.page + 1)}
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground/60">
                Next
              </span>
            )}
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
