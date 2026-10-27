import type { JobListItem } from "@/lib/types";
import { JobRecordTable } from "@/components/job-record-table";

export function RecentItemsList({ records }: { records: JobListItem[] }) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
        <h2 className="text-2xl font-semibold text-foreground">Recent active</h2>
        </div>
      </div>
      <JobRecordTable
        detailBasePath="/active"
        emptyTitle="No Active records yet"
        records={records}
      />
    </div>
  );
}
