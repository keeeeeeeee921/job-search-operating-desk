import Link from "next/link";
import { JobRecordTable } from "@/components/job-record-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import type { PaginatedJobListResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function buildPageHref(basePath: string, page: number, query: string) {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const serialized = params.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

function formatRange(pageData: PaginatedJobListResult) {
  if (pageData.totalCount === 0) {
    return "No records to show";
  }

  const start = (pageData.page - 1) * pageData.pageSize + 1;
  const end = Math.min(pageData.totalCount, pageData.page * pageData.pageSize);
  return `Showing ${start}-${end} of ${pageData.totalCount}`;
}

export function ListPageView({
  title,
  description,
  pageData,
  basePath,
  searchable = false,
  searchPlaceholder = "Search Active records by company or role",
  detailBasePath,
  query = ""
}: {
  title: string;
  description: string;
  pageData: PaginatedJobListResult;
  basePath: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  detailBasePath?: string;
  query?: string;
}) {
  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {searchable ? "Search" : "Records"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{formatRange(pageData)}</div>
        </div>

        {searchable ? (
          <form action={basePath} className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <Input
              autoFocus
              defaultValue={query}
              name="q"
              placeholder={searchPlaceholder}
            />
            <div className="flex gap-2">
              <Button type="submit">Search</Button>
              {query ? (
                <Link
                  className={cn(
                    "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200",
                    "border-transparent bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                  href={basePath}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}
      </Surface>

      <JobRecordTable
        detailBasePath={detailBasePath}
        emptyDescription={
          searchable
            ? "Try another company or role title. Search only scans Active records."
            : "This list is empty right now."
        }
        emptyTitle={searchable ? "No matching Active records" : "No records yet"}
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
                href={buildPageHref(basePath, pageData.page - 1, query)}
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
                href={buildPageHref(basePath, pageData.page + 1, query)}
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
