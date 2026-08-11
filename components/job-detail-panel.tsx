"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { jobStageLabels, selectableJobStages } from "@/lib/job-stage";
import { formatSourceTypeLabel } from "@/lib/sourceDetection";
import type { JobRecord, JobStage } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function getDraftStorageKey(id: string) {
  return `job-desk-comments-draft:${id}`;
}

export function JobDetailPanel({
  record,
  onDelete,
  onSaveComments,
  onSaveStage
}: {
  record: JobRecord;
  onDelete: () => Promise<void>;
  onSaveComments: (comments: string) => Promise<void>;
  onSaveStage: (stage: JobStage) => Promise<void>;
}) {
  const [comments, setComments] = useState(record.comments);
  const [stage, setStage] = useState(record.stage);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const latestCommentsRef = useRef(record.comments);

  useEffect(() => {
    setComments(record.comments);
    setStage(record.stage);
    latestCommentsRef.current = record.comments;
  }, [record.comments, record.stage]);

  useEffect(() => {
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
  }, [onSaveComments, record.comments, record.id]);

  useEffect(() => {
    latestCommentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    if (comments === record.comments) {
      window.sessionStorage.removeItem(getDraftStorageKey(record.id));
    }
  }, [comments, record.comments, record.id]);

  useEffect(() => {
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
  }, [record.comments, record.id]);

  return (
    <div>
      <Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:opacity-80" href="/active">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to Active
      </Link>

      <div className="mt-5 flex flex-col gap-5 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">{record.company}</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {record.roleTitle}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {record.location} · Saved {formatDate(record.timestamp)}
          </p>
        </div>
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
      <Surface className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">Record status</h2>
        <div className="mt-5 space-y-5">
          <Field label="Role Title" value={record.roleTitle} />
          <Field label="Company" value={record.company} />
          <Field label="Location" value={record.location} />
          <Field
            label="Source"
            value={
              record.sourceType === "unknown"
                ? "Source unclear"
                : formatSourceTypeLabel(record.sourceType)
            }
          />
          <Field label="Timestamp" value={formatDate(record.timestamp)} />
          <Field
            label="Search Cycle"
            value={record.searchCycleLabel ?? "Not set"}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="job-stage-select">Stage</label>
            <select
              className="mt-2 w-full rounded-2xl border border-border bg-muted/60 px-3 py-2 text-base text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 sm:text-sm"
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
          </div>
        </div>
      </Surface>
      <div className="space-y-6">
        <Surface className="p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Follow-up notes</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Keep recruiter updates, interview progress, and the next action close to the stage control.
            </p>
          </div>
          <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="job-comments">Comments</label>
          <Textarea
            className="mt-2 min-h-48"
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
            placeholder="Add a note..."
            value={comments}
          />
        </Surface>

        <Surface className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-foreground">Job description</h2>
          <div className={descriptionExpanded ? "" : "max-h-64 overflow-hidden"}>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {record.jobDescription}
            </p>
          </div>
          <Button className="mt-4" onClick={() => setDescriptionExpanded((current) => !current)} tone="secondary">
            {descriptionExpanded ? "Collapse description" : "Show full description"}
          </Button>
        </Surface>

        <Surface className="flex flex-col gap-4 border-rose-200 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-rose-800">Delete record</h2>
            <p className="mt-1 text-sm text-rose-700">Permanently removes this application.</p>
          </div>
          <Button
            onClick={() => {
              if (window.confirm("Delete this record permanently? This can't be undone.")) {
                void onDelete();
              }
            }}
            tone="danger"
          >
            Delete record
          </Button>
        </Surface>
      </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
