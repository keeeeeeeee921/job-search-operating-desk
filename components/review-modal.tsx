"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatFieldOriginLabel,
  isFieldRequiredForDraft,
  labelForField
} from "@/lib/recordValidation";
import { mergeDraftField } from "@/lib/extractor";
import {
  requiredJobFields,
  type JobDraft,
  type JobField,
  type ValidationIssue
} from "@/lib/types";
import { cn } from "@/lib/utils";

const chipCandidateFields = new Set<JobField>([
  "roleTitle",
  "company",
  "location"
]);

function issueForField(issues: ValidationIssue[], field: JobField) {
  return issues.filter((issue) => issue.field === field);
}

export function ReviewModal({
  open,
  onOpenChange,
  draft,
  onSave,
  onCancel
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: JobDraft | null;
  onSave: (draft: JobDraft) => void;
  onCancel: () => void;
}) {
  const [localDraft, setLocalDraft] = useState<JobDraft | null>(draft);

  useEffect(() => {
    setLocalDraft(draft);
  }, [draft]);

  if (!localDraft) {
    return null;
  }

  const sortedFields = [...requiredJobFields].sort((left, right) => {
    const leftIssues = issueForField(localDraft.issues, left);
    const rightIssues = issueForField(localDraft.issues, right);
    if (leftIssues.length !== rightIssues.length) {
      return rightIssues.length - leftIssues.length;
    }

    const leftScore = localDraft.confidenceScores?.[left] ?? 0;
    const rightScore = localDraft.confidenceScores?.[right] ?? 0;
    return leftScore - rightScore;
  });

  return (
    <Dialog
      className="h-[min(82dvh,860px)] sm:h-[min(86dvh,920px)]"
      description="A few fields need a quick check before this goes into Active."
      onOpenChange={onOpenChange}
      open={open}
      title="Review before saving"
    >
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border/80 pb-4">
          <Button onClick={onCancel} tone="ghost">
            Cancel
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain py-4 pr-2">
          <div className="space-y-4 pb-10">
            {localDraft.unsupportedReason ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {localDraft.unsupportedReason}
              </div>
            ) : null}
            {sortedFields.map((field) => {
              const issues = issueForField(localDraft.issues, field);
              const value = localDraft[field];
              const confidenceScore = localDraft.confidenceScores?.[field];
              const candidates = Array.from(
                new Set((localDraft.candidateValues[field] ?? []).filter(Boolean))
              );
              const shouldShowCandidates =
                chipCandidateFields.has(field) && candidates.length >= 2;
              const FieldComponent = field === "jobDescription" ? Textarea : Input;

              return (
                <div
                  className={cn(
                    "rounded-[24px] border px-4 py-4",
                    issues.length > 0
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-border bg-surface"
                  )}
                  key={field}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {labelForField(field)}
                      </p>
                      <div className="mt-2 space-y-1">
                        {issues.length > 0 ? (
                          issues.map((issue) => (
                            <p className="text-xs text-amber-900" key={issue.message}>
                              {issue.message}
                            </p>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {field === "link" && !isFieldRequiredForDraft(localDraft, field)
                              ? "Optional for pasted job text."
                              : "Looks good."}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatFieldOriginLabel(localDraft.fieldOrigins[field] ?? "missing")}
                    </p>
                  </div>
                  {confidenceScore !== undefined ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Confidence {Math.round(confidenceScore * 100)}%
                    </p>
                  ) : null}
                  {shouldShowCandidates ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidates.map((candidate) => (
                        <button
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition",
                            value === candidate
                              ? "border-accent/20 bg-accent text-accent-foreground"
                              : "border-border bg-white text-muted-foreground hover:text-foreground"
                          )}
                          key={candidate}
                          onClick={() =>
                            setLocalDraft(mergeDraftField(localDraft, field, candidate))
                          }
                          type="button"
                        >
                          {candidate}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <FieldComponent
                    className="mt-3"
                    onChange={(event) =>
                      setLocalDraft(
                        mergeDraftField(localDraft, field, event.target.value)
                      )
                    }
                    value={value}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-border/80 bg-white pt-4">
          <Button onClick={onCancel} tone="ghost">
            Cancel
          </Button>
          <Button
            disabled={localDraft.issues.length > 0}
            onClick={() => onSave(localDraft)}
          >
            Save to Active
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
