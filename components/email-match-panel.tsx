"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { MailSearch } from "lucide-react";
import { matchRejectionEmail } from "@/app/actions";
import { useDemoMode } from "@/components/demo-mode-provider";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { useJobDeskStore } from "@/lib/store";
import type { EmailMatch } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function EmailMatchPanel({
  hasActiveJobs
}: {
  hasActiveJobs: boolean;
}) {
  const router = useRouter();
  const demoMode = useDemoMode();
  const pushToast = useJobDeskStore((state) => state.pushToast);
  const [value, setValue] = useState("");
  const [matches, setMatches] = useState<EmailMatch[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const emptyState = !hasActiveJobs;

  async function runMatch() {
    const nextValue = value.trim();

    if (!nextValue || emptyState || isMatching) {
      return;
    }

    setIsMatching(true);
    try {
      const nextMatches = await matchRejectionEmail(nextValue);
      setMatches(nextMatches);

      if (nextMatches.length > 0) {
        setValue("");
      }
    } finally {
      setIsMatching(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="xl:col-span-2 px-1">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground">
          Email Match
        </h1>
      </div>

      <Surface className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">Rejection email</h2>
        <label className="sr-only" htmlFor="rejection-email-input">
          Email text or job title and company
        </label>
        <Textarea
          className="mt-4 min-h-[260px]"
          id="rejection-email-input"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }

            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              startTransition(() => {
                void runMatch();
              });
            }
          }}
          placeholder="Paste a rejection email or job title + company. Enter to match."
          value={value}
        />
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!value.trim() || emptyState || isMatching}
            onClick={() => {
              startTransition(() => {
                void runMatch();
              });
            }}
          >
            <MailSearch aria-hidden="true" className="mr-2 size-4" />
            {isMatching ? "Finding matches" : "Find matches"}
          </Button>
        </div>
      </Surface>
      <Surface className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">Likely matches</h2>
        <div className="mt-4 space-y-3">
          {matches.length === 0 ? (
            <div className="grid min-h-[260px] place-items-center rounded-2xl bg-muted/50 px-5 py-8 text-center">
              <div>
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MailSearch aria-hidden="true" className="size-5" />
              </div>
              <p className="text-base font-semibold text-foreground">
                {emptyState ? "No Active records yet" : "No matches yet"}
              </p>
              </div>
            </div>
          ) : (
            matches.map((match) => (
              <div
                className="border-t border-border py-4 first:border-t-0 first:pt-0"
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
                <p className="mt-3 text-sm font-medium text-accent">
                  {match.reasons.join(" · ")}
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={demoMode}
                    title={demoMode ? "Archiving is disabled in the read-only demo." : undefined}
                    onClick={async () => {
                      const response = await fetch(`/api/jobs/${match.record.id}/archive`, {
                        method: "POST",
                        keepalive: true
                      }).catch(() => null);

                      if (!response?.ok) {
                        pushToast("Couldn't move record to Rejected", "error");
                        return;
                      }

                      setMatches((current) =>
                        current.filter((item) => item.record.id !== match.record.id)
                      );
                      pushToast("Moved to Rejected", "success");
                      router.refresh();
                    }}
                    tone="secondary"
                  >
                    {demoMode ? "Archive disabled (demo)" : "Archive to Rejected"}
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
