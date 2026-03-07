"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { DuplicateCandidate } from "@/lib/types";
import { formatDate, truncate } from "@/lib/utils";

interface DuplicateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: DuplicateCandidate[];
  onContinue: () => void;
  onCancel: () => void;
}

export function DuplicateModal({
  open,
  onOpenChange,
  candidates,
  onContinue,
  onCancel
}: DuplicateModalProps) {
  return (
    <Dialog
      className="overflow-hidden"
      description="These existing records look similar. Review them before you add another Active record."
      onOpenChange={onOpenChange}
      open={open}
      title="Possible duplicate found"
    >
      <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
        {candidates.map((candidate) => (
          <div
            className="rounded-[24px] border border-border bg-surface px-4 py-4"
            key={candidate.record.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {candidate.record.roleTitle}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {candidate.record.company} · {candidate.record.location}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Saved {formatDate(candidate.record.timestamp)}
              </p>
            </div>
            {candidate.record.link ? (
              <a
                className="mt-3 block break-all text-sm text-accent"
                href={candidate.record.link}
                rel="noreferrer"
                target="_blank"
              >
                {candidate.record.link}
              </a>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Link not saved</p>
            )}
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {truncate(candidate.record.jobDescription, 180)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {candidate.reasons.join(" · ")}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-border/80 bg-white pt-4">
        <Button onClick={onCancel} tone="ghost">
          Cancel
        </Button>
        <Button onClick={onContinue}>Continue anyway</Button>
      </div>
    </Dialog>
  );
}
