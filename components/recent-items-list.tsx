import { Surface } from "@/components/ui/surface";
import type { JobRecord } from "@/lib/types";
import { JobRecordTable } from "@/components/job-record-table";

export function RecentItemsList({ records }: { records: JobRecord[] }) {
  return (
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
        records={records}
      />
    </Surface>
  );
}
