import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { jobStageLabels } from "@/lib/job-stage";
import { formatSourceTypeLabel } from "@/lib/sourceDetection";
import type { JobListItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function JobRecordRow({
  record,
  href
}: {
  record: JobListItem;
  href?: string;
}) {
  const roleLabel = record.roleTitle || "Role title not extracted";
  const sourceLabel =
    record.sourceType === "unknown"
      ? "Source unclear"
      : record.extractionStatus === "needs_review"
        ? `Reviewed · ${formatSourceTypeLabel(record.sourceType)}`
        : formatSourceTypeLabel(record.sourceType);

  return (
    <div className="grid gap-3 border-b border-border py-4 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_minmax(120px,0.8fr)_minmax(130px,0.9fr)_minmax(90px,0.6fr)_auto] lg:items-center lg:gap-5">
      <div className="min-w-0">
        {href ? (
          <Link
            className="font-semibold text-foreground transition hover:text-accent"
            href={href}
          >
            {roleLabel}
          </Link>
        ) : (
          <p className="font-semibold text-foreground">{roleLabel}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {record.company} · {sourceLabel}
        </p>
      </div>

      <div>
        <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {jobStageLabels[record.stage]}
        </span>
      </div>

      <p className="min-w-0 break-words text-sm text-muted-foreground">
        {record.location}
      </p>

      <p className="text-sm text-muted-foreground">
        {formatDate(record.timestamp)}
      </p>

      <div className="flex items-center gap-1 lg:justify-end">
        {record.link ? (
          <a
            aria-label={`Open posting for ${roleLabel}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            href={record.link}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        ) : null}
        {href ? (
          <Link
            aria-label={`Open ${roleLabel}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            href={href}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
