"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
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

  return (
    <Dialog
      className="max-h-[min(90vh,980px)]"
      description="Required fields are missing or low-confidence. Confirm the record before it can be saved to Active."
      onOpenChange={onOpenChange}
      open={open}
      title="Missing fields need review"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
          {localDraft.unsupportedReason ? (
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {localDraft.unsupportedReason}
            </div>
          ) : null}
          {requiredJobFields.map((field) => {
            const issues = issueForField(localDraft.issues, field);
            const value = localDraft[field];
            const candidates = localDraft.candidateValues[field] ?? [];
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
                            : "Ready to save."}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {localDraft.fieldOrigins[field] ?? "missing"}
                  </p>
                </div>
                {candidates.length > 0 ? (
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
        <div className="mt-5 flex shrink-0 justify-end gap-3 border-t border-border/80 bg-white pt-4">
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
