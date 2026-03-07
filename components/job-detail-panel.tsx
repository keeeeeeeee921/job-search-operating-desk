"use client";

import { useEffect, useRef, useState } from "react";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import type { JobRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function getDraftStorageKey(id: string) {
  return `job-desk-comments-draft:${id}`;
}

export function JobDetailPanel({
  record,
  onSaveComments
}: {
  record: JobRecord;
  onSaveComments: (comments: string) => Promise<void>;
}) {
  const [comments, setComments] = useState(record.comments);
  const latestCommentsRef = useRef(record.comments);

  useEffect(() => {
    setComments(record.comments);
    latestCommentsRef.current = record.comments;
  }, [record.comments]);

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
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.4fr]">
      <Surface className="border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,245,250,0.86))] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Record
        </p>
        <div className="mt-5 space-y-5">
          <Field label="Role Title" value={record.roleTitle} />
          <Field label="Company" value={record.company} />
          <Field label="Location" value={record.location} />
          <Field label="Source" value={record.sourceType === "unknown" ? "Source not confirmed" : record.sourceType} />
          <Field label="Timestamp" value={formatDate(record.timestamp)} />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Link
            </p>
            <a
              className="mt-2 block break-all text-sm text-accent"
              href={record.link}
              rel="noreferrer"
              target="_blank"
            >
              {record.link}
            </a>
          </div>
        </div>
      </Surface>
      <div className="space-y-6">
        <Surface className="border-white/60 bg-white/80 p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Job Description
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {record.jobDescription}
          </p>
        </Surface>
        <Surface className="border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,247,251,0.88))] p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Comments
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep this for meaningful progress notes like interviews, OA, follow-up, or recruiter response.
          </p>
          <Textarea
            className="mt-4 min-h-48"
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
            placeholder="Add a progress note..."
            value={comments}
          />
        </Surface>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
