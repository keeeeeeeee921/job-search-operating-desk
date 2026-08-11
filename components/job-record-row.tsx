import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { jobStageLabels } from "@/lib/job-stage";
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
  const roleMeta = [record.company, record.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group -mx-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border-b border-border px-3 py-4 transition-colors duration-200 last:border-b-0 hover:bg-muted/55 focus-within:bg-muted/55 lg:grid-cols-[minmax(0,2fr)_minmax(120px,0.8fr)_minmax(90px,0.6fr)_76px] lg:items-center lg:gap-5">
      <div className="col-span-2 min-w-0 lg:col-span-1">
        {href ? (
          <Link
            className="line-clamp-2 rounded-sm font-semibold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            href={href}
          >
            {roleLabel}
          </Link>
        ) : (
          <p className="line-clamp-2 font-semibold text-foreground">{roleLabel}</p>
        )}
        <p className="mt-1 truncate text-sm text-muted-foreground" title={roleMeta}>
          {roleMeta}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-3 lg:contents">
        <div>
          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {jobStageLabels[record.stage]}
          </span>
        </div>

        <p className="truncate text-sm text-muted-foreground">
          {formatDate(record.timestamp)}
        </p>
      </div>

      <div className="flex items-center justify-self-end gap-1 lg:justify-self-auto lg:justify-end">
        {record.link ? (
          <a
            aria-label={`Open posting for ${roleLabel}`}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.96]"
            href={record.link}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        ) : (
          <span
            aria-label={`No saved posting link for ${roleLabel}`}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground/40"
            role="img"
            title="No URL saved"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </span>
        )}
        {href ? (
          <Link
            aria-label={`Open ${roleLabel}`}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.96]"
            href={href}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
