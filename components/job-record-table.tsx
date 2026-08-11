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
    <div className="overflow-hidden rounded-3xl border border-border bg-surface px-5 shadow-soft">
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(120px,0.8fr)_minmax(130px,0.9fr)_minmax(90px,0.6fr)_auto] gap-5 border-b border-border py-3 text-xs font-medium text-muted-foreground lg:grid">
        <span>Role</span>
        <span>Stage</span>
        <span>Location</span>
        <span>Saved</span>
        <span className="w-[76px]">Actions</span>
      </div>
      <div>
        {records.map((record) => (
          <JobRecordRow
            href={detailBasePath ? `${detailBasePath}/${record.id}` : undefined}
            key={record.id}
            record={record}
          />
        ))}
      </div>
    </div>
  );
}
