import type { JobListItem } from "@/lib/types";
import { JobRecordTable } from "@/components/job-record-table";

export function RecentItemsList({ records }: { records: JobListItem[] }) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
        <h2 className="text-2xl font-semibold text-foreground">Recent active</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          The newest records in the current working set.
        </p>
        </div>
      </div>
      <JobRecordTable
        detailBasePath="/active"
        emptyDescription="Saved records will show up here after review."
        emptyTitle="No Active records yet"
        records={records}
      />
    </div>
  );
}
