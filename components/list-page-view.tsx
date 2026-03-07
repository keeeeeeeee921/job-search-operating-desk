"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobRecordTable } from "@/components/job-record-table";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { searchActiveJobs } from "@/lib/search";
import type { JobRecord } from "@/lib/types";

export function ListPageView({
  title,
  description,
  records,
  searchable = false,
  searchPlaceholder = "Search Active records by company or role",
  detailBasePath,
  refreshOnMount = false
}: {
  title: string;
  description: string;
  records: JobRecord[];
  searchable?: boolean;
  searchPlaceholder?: string;
  detailBasePath?: string;
  refreshOnMount?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!refreshOnMount) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshOnMount, router]);

  const filteredRecords = searchable
    ? searchActiveJobs(records, deferredQuery)
    : records;

  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {searchable ? "Search" : "Records"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {searchable ? (
          <div className="mt-5 max-w-xl">
            <Input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>
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
        records={filteredRecords}
      />
    </div>
  );
}
