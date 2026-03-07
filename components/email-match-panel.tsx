"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { matchRejectionEmail } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { useJobDeskStore } from "@/lib/store";
import { demoRejectionEmails } from "@/lib/seed";
import type { EmailMatch } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function EmailMatchPanel({
  hasActiveJobs
}: {
  hasActiveJobs: boolean;
}) {
  const router = useRouter();
  const pushToast = useJobDeskStore((state) => state.pushToast);
  const [value, setValue] = useState("");
  const [matches, setMatches] = useState<EmailMatch[]>([]);
  const emptyState = !hasActiveJobs;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Rejection Email
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          Match a rejection email to the right Active record
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Paste the email body, search Active records for the closest matches, then archive the correct job manually.
        </p>
        <Textarea
          className="mt-6 min-h-[280px]"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a rejection email here..."
          value={value}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {demoRejectionEmails.map((item) => (
            <Button
              key={item.id}
              onClick={() => {
                setValue(item.body);
                startTransition(async () => {
                  setMatches(await matchRejectionEmail(item.body));
                });
              }}
              tone="secondary"
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!value.trim() || emptyState}
            onClick={() =>
              startTransition(async () => {
                setMatches(await matchRejectionEmail(value));
              })
            }
          >
            Find matches
          </Button>
        </div>
      </Surface>
      <Surface className="p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Likely Matches
        </p>
        <div className="mt-5 space-y-3">
          {matches.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center">
              <p className="text-base font-semibold text-foreground">
                {emptyState ? "No Active records to match yet" : "No matches yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {emptyState
                  ? "Save a few Active records first, then come back to archive rejections."
                  : "Paste an email and run matching to see likely candidates."}
              </p>
            </div>
          ) : (
            matches.map((match) => (
              <div
                className="rounded-[24px] border border-border bg-white/85 px-4 py-4"
                key={match.record.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {match.record.roleTitle}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {match.record.company} · {match.record.location}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saved {formatDate(match.record.timestamp)}
                  </p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {match.reasons.join(" · ")}
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => {
                      fetch(`/api/jobs/${match.record.id}/archive`, {
                        method: "POST",
                        keepalive: true
                      }).catch(() => {
                        pushToast("Archive could not be completed", "error");
                      });

                      setMatches((current) =>
                        current.filter((item) => item.record.id !== match.record.id)
                      );
                      pushToast("Moved to Rejected", "success");
                      router.refresh();
                    }}
                    tone="secondary"
                  >
                    Archive to Rejected
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
}
