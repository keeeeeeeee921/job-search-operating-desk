"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { JobDetailPanel } from "@/components/job-detail-panel";
import { Surface } from "@/components/ui/surface";
import { useJobDeskStore } from "@/lib/store";
import type { JobRecord } from "@/lib/types";

export function ActiveDetailPageClient({
  record
}: {
  record: JobRecord | null;
}) {
  const pushToast = useJobDeskStore((state) => state.pushToast);
  const [currentRecord, setCurrentRecord] = useState(record);

  return (
    <AppShell currentPath="/active">
      {currentRecord ? (
        <JobDetailPanel
          onSaveComments={async (comments) => {
            if (comments === currentRecord.comments) {
              return;
            }

            const response = await fetch(`/api/jobs/${currentRecord.id}/comments`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ comments }),
              keepalive: true
            });

            if (!response.ok) {
              pushToast("Comments could not be saved", "error");
              return;
            }

            setCurrentRecord({ ...currentRecord, comments });
            pushToast("Comments saved", "success");
          }}
          record={currentRecord}
        />
      ) : (
        <Surface className="p-8 text-center">
          <p className="text-xl font-semibold text-foreground">
            Active record not found
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            The record may have been archived or removed from the database.
          </p>
          <div className="mt-5">
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent/20 hover:bg-white"
              href="/active"
            >
              Back to Active
            </Link>
          </div>
        </Surface>
      )}
    </AppShell>
  );
}
