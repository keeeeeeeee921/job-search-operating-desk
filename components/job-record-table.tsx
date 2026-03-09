import type { JobListItem } from "@/lib/types";
import { JobRecordRow } from "@/components/job-record-row";

export function JobRecordTable({
  records,
  emptyTitle,
  emptyDescription,
  detailBasePath
}: {
  records: JobListItem[];
  emptyTitle: string;
  emptyDescription: string;
  detailBasePath?: string;
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-[30px] border border-dashed border-border bg-white/70 px-6 py-10 text-center">
        <p className="text-base font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <JobRecordRow
          href={detailBasePath ? `${detailBasePath}/${record.id}` : undefined}
          key={record.id}
          record={record}
        />
      ))}
    </div>
  );
}
