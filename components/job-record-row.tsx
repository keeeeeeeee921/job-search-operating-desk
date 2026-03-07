import Link from "next/link";
import type { JobRecord } from "@/lib/types";
import { cn, formatDate, truncate } from "@/lib/utils";

export function JobRecordRow({
  record,
  href,
  compact = false
}: {
  record: JobRecord;
  href?: string;
  compact?: boolean;
}) {
  const roleLabel = record.roleTitle || "Role title not extracted";
  const sourceLabel =
    record.sourceType === "unknown"
      ? "Source not confirmed"
      : `${record.extractionStatus === "needs_review" ? "Reviewed manually" : "Confirmed"} · ${record.sourceType}`;

  return (
    <div
      className={cn(
        "grid gap-4 rounded-[26px] border border-border/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,248,252,0.84))] px-5 py-4 shadow-soft transition hover:-translate-y-0.5 hover:border-accent/20 hover:bg-white hover:shadow-lift",
        compact
          ? "grid-cols-1"
          : "grid-cols-1 xl:grid-cols-[1.2fr_1.1fr_0.8fr_0.8fr_1.5fr]"
      )}
    >
      <div className="xl:pr-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Role Title
        </p>
        {href ? (
          <Link
            className="mt-2 inline-block text-sm font-semibold text-foreground transition hover:text-accent"
            href={href}
          >
            {roleLabel}
          </Link>
        ) : (
          <p className="mt-2 text-sm font-semibold text-foreground">{roleLabel}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{sourceLabel}</p>
      </div>
      <div className="xl:border-l xl:border-border/70 xl:pl-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Link
        </p>
        <a
          className="mt-2 block break-all text-sm text-accent transition hover:opacity-80"
          href={record.link}
          rel="noreferrer"
          target="_blank"
        >
          {record.link}
        </a>
      </div>
      <div className="xl:border-l xl:border-border/70 xl:pl-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Company
        </p>
        <p className="mt-2 text-sm text-foreground">{record.company}</p>
      </div>
      <div className="xl:border-l xl:border-border/70 xl:pl-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Location
        </p>
        <p className="mt-2 text-sm text-foreground">{record.location}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Saved {formatDate(record.timestamp)}
        </p>
      </div>
      <div className="xl:border-l xl:border-border/70 xl:pl-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Job Description
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {truncate(record.jobDescription, compact ? 200 : 180)}
        </p>
      </div>
    </div>
  );
}
