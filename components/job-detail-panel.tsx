"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { useDemoMode } from "@/components/demo-mode-provider";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { jobStageLabels, selectableJobStages } from "@/lib/job-stage";
import { formatSourceTypeLabel } from "@/lib/sourceDetection";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo-mode";
import type { JobRecord, JobStage } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function getDraftStorageKey(id: string) {
  return `job-desk-comments-draft:${id}`;
}

export function JobDetailPanel({
  record,
  backHref = "/active",
  onDelete,
  onSaveComments,
  onSaveStage
}: {
  record: JobRecord;
  /** The Active list view (cycle, query, page) this record was opened from. */
  backHref?: string;
  onDelete: () => Promise<void>;
  onSaveComments: (comments: string) => Promise<void>;
  onSaveStage: (stage: JobStage) => Promise<void>;
}) {
  const demoMode = useDemoMode();
  const [comments, setComments] = useState(record.comments);
  const [stage, setStage] = useState(record.stage);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const latestCommentsRef = useRef(record.comments);

  // Only offer "Show full description" when the clamp actually hides text.
  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (element && !descriptionExpanded) {
      setDescriptionOverflows(element.scrollHeight > element.clientHeight + 1);
    }
  }, [descriptionExpanded, record.jobDescription]);

  useEffect(() => {
    setComments(record.comments);
    setStage(record.stage);
    latestCommentsRef.current = record.comments;
  }, [record.comments, record.stage]);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    const savedDraft = window.sessionStorage.getItem(getDraftStorageKey(record.id));
    if (!savedDraft || savedDraft === record.comments) {
      if (savedDraft === record.comments) {
        window.sessionStorage.removeItem(getDraftStorageKey(record.id));
      }
      return;
    }

    setComments(savedDraft);
    latestCommentsRef.current = savedDraft;
    void onSaveComments(savedDraft);
  }, [demoMode, onSaveComments, record.comments, record.id]);

  useEffect(() => {
    latestCommentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    if (comments === record.comments) {
      window.sessionStorage.removeItem(getDraftStorageKey(record.id));
    }
  }, [comments, record.comments, record.id]);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    const handlePageHide = () => {
      const nextComments = latestCommentsRef.current;

      if (nextComments === record.comments) {
        return;
      }

      const payload = new Blob([JSON.stringify({ comments: nextComments })], {
        type: "application/json"
      });
      navigator.sendBeacon(`/api/jobs/${record.id}/comments`, payload);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [demoMode, record.comments, record.id]);

  const meta = [
    record.location,
    record.sourceType === "unknown" ? null : formatSourceTypeLabel(record.sourceType),
    record.searchCycleLabel,
    `Saved ${formatDate(record.timestamp)}`
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:opacity-80" href={backHref}>
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to Active
      </Link>

      <div className="mt-5 flex flex-col gap-5 px-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent">{record.company}</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {record.roleTitle}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{meta}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="job-stage-select">Stage</label>
          <select
            aria-describedby={demoMode ? "job-stage-demo-note" : undefined}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground outline-none transition hover:bg-muted focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={demoMode}
            id="job-stage-select"
            onChange={(event) => {
              const nextStage = event.target.value as JobStage;
              setStage(nextStage);
              void onSaveStage(nextStage);
            }}
            value={stage}
          >
            {selectableJobStages.map((option) => (
              <option key={option} value={option}>
                {jobStageLabels[option]}
              </option>
            ))}
          </select>
          {record.link ? (
            <a
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              href={record.link}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Open posting
            </a>
          ) : null}
        </div>
      </div>
      {demoMode ? (
        <p className="mt-2 px-1 text-xs text-muted-foreground" id="job-stage-demo-note">
          Stage changes are disabled in the read-only demo.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <Surface className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">
            <label htmlFor="job-comments">Notes</label>
          </h2>
          <Textarea
            aria-describedby={demoMode ? "job-comments-demo-note" : undefined}
            className="mt-2 min-h-48 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={demoMode}
            id="job-comments"
            onBlur={() => {
              void onSaveComments(comments);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setComments(nextValue);
              window.sessionStorage.setItem(
                getDraftStorageKey(record.id),
                nextValue
              );
            }}
            placeholder={demoMode ? "Comments are read-only in the demo." : "Add a note..."}
            value={comments}
          />
          {demoMode ? (
            <p className="mt-2 text-xs text-muted-foreground" id="job-comments-demo-note">
              {DEMO_READ_ONLY_MESSAGE}
            </p>
          ) : null}
        </Surface>

        <Surface className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">Job description</h2>
          <div
            className={descriptionExpanded ? "" : "max-h-64 overflow-hidden"}
            ref={descriptionRef}
          >
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {record.jobDescription}
            </p>
          </div>
          {descriptionOverflows ? (
            <Button className="mt-4" onClick={() => setDescriptionExpanded((current) => !current)} tone="secondary">
              {descriptionExpanded ? "Collapse description" : "Show full description"}
            </Button>
          ) : null}
        </Surface>
      </div>

      <div className="mt-6 flex items-center justify-end gap-4 px-1">
        {demoMode ? (
          <p className="text-sm text-muted-foreground">
            Deleting is disabled in the read-only demo.
          </p>
        ) : null}
        <Button
          disabled={demoMode}
          onClick={() => {
            if (window.confirm("Delete this record permanently? This can't be undone.")) {
              void onDelete();
            }
          }}
          tone="danger"
        >
          Delete record
        </Button>
      </div>
    </div>
  );
}
