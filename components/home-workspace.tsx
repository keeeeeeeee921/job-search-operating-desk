"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJobFromLink, createJobFromText, saveReviewedJob } from "@/app/actions";
import { DailyGoalsWidget } from "@/components/daily-goals-widget";
import { DuplicateModal } from "@/components/duplicate-modal";
import { JobLinkInput } from "@/components/job-link-input";
import { JobTextInput } from "@/components/job-text-input";
import { ProcessingStatus } from "@/components/processing-status";
import { RecentItemsList } from "@/components/recent-items-list";
import { ReviewModal } from "@/components/review-modal";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { toJobListItem } from "@/lib/job-list";
import { useJobDeskStore } from "@/lib/store";
import type {
  DailyGoalsState,
  DuplicateCandidate,
  InputMode,
  JobDraft,
  JobListItem,
  JobRecord
} from "@/lib/types";

export function HomeWorkspace({
  initialRecentItems,
  initialGoals
}: {
  initialRecentItems: JobListItem[];
  initialGoals: DailyGoalsState;
}) {
  const router = useRouter();
  const pushToast = useJobDeskStore((state) => state.pushToast);

  const [inputMode, setInputMode] = useState<InputMode>("link");
  const [linkValue, setLinkValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<JobDraft | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<JobDraft | null>(null);
  const [recentItems, setRecentItems] = useState(initialRecentItems);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateCandidate[]
  >([]);

  const handleServerResult = (
    result:
      | { status: "review"; draft: JobDraft }
      | {
          status: "duplicate";
          draft: JobDraft;
          candidates: DuplicateCandidate[];
        }
      | { status: "saved"; record: JobRecord }
  ) => {
    if (result.status === "review") {
      setReviewDraft(result.draft);
      pushToast("Review needed", "warning");
      setProcessingStatus(null);
      return;
    }

    if (result.status === "duplicate") {
      setDuplicateDraft(result.draft);
      setDuplicateCandidates(result.candidates);
      pushToast("Possible duplicate", "warning");
      setProcessingStatus(null);
      return;
    }

    setRecentItems((current) =>
      [toJobListItem(result.record), ...current.filter((item) => item.id !== result.record.id)].slice(0, 4)
    );
    pushToast("Saved to Active", "success");
    setProcessingStatus(null);
    setLinkValue("");
    setTextValue("");
    setReviewDraft(null);
    setDuplicateDraft(null);
    setDuplicateCandidates([]);
    router.refresh();
  };

  async function showProcessingStages(stages: string[], delayMs = 120) {
    for (const stage of stages) {
      setProcessingStatus(stage);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, delayMs);
      });
    }
  }

  const handleProcess = async () => {
    const activeValue = inputMode === "link" ? linkValue : textValue;
    if (!activeValue.trim()) {
      return;
    }

    if (inputMode === "link") {
      await showProcessingStages([
        "Processing...",
        "Detecting source...",
        "Preparing job record...",
        "Checking duplicates..."
      ]);
      handleServerResult(await createJobFromLink(linkValue));
      return;
    }

    await showProcessingStages([
      "Processing...",
      "Parsing pasted job text...",
      "Preparing job record...",
      "Checking duplicates..."
    ]);
    handleServerResult(await createJobFromText(textValue));
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 px-1 pb-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">Today</p>
              <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                Keep the working set honest.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                Capture a role, review uncertain fields, and move on without cluttering the active list.
              </p>
            </div>
            <div className="flex justify-center sm:shrink-0 sm:justify-start">
                <Image
                  alt="Animated line drawing of a small office character sitting among papers."
                  className="h-auto w-24 object-contain sm:w-28"
                  height={128}
                  src="/pool-honest-bear.gif"
                  unoptimized
                  width={128}
                />
            </div>
          </div>

          <Surface className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">Add a job</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Incomplete extraction pauses for review before anything is saved.
            </p>
            <div className="mt-6">
              <div className="mb-5 inline-flex gap-1 rounded-xl bg-muted p-1">
                <Button
                  className="rounded-lg"
                  onClick={() => setInputMode("link")}
                  tone={inputMode === "link" ? "secondary" : "ghost"}
                  type="button"
                >
                  Paste link
                </Button>
                <Button
                  className="rounded-lg"
                  onClick={() => setInputMode("text")}
                  tone={inputMode === "text" ? "secondary" : "ghost"}
                  type="button"
                >
                  Paste job text
                </Button>
              </div>
              {inputMode === "link" ? (
                <JobLinkInput
                  disabled={false}
                  onChange={setLinkValue}
                  onSubmit={handleProcess}
                  value={linkValue}
                />
              ) : (
                <JobTextInput
                  disabled={false}
                  onChange={setTextValue}
                  onSubmit={handleProcess}
                  value={textValue}
                />
              )}
              <ProcessingStatus status={processingStatus} />
            </div>
          </Surface>
          <RecentItemsList records={recentItems} />
        </div>
        <div>
          <DailyGoalsWidget initialGoals={initialGoals} />
        </div>
      </div>

      <ReviewModal
        draft={reviewDraft}
        onCancel={() => {
          setReviewDraft(null);
          setProcessingStatus(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDraft(null);
          }
        }}
        onSave={(draft) => {
          setReviewDraft(null);
          void saveReviewedJob(draft).then(handleServerResult);
        }}
        open={Boolean(reviewDraft)}
      />
      <DuplicateModal
        candidates={duplicateCandidates}
        onCancel={() => {
          setDuplicateDraft(null);
          setDuplicateCandidates([]);
        }}
        onContinue={() => {
          if (duplicateDraft) {
            void saveReviewedJob(duplicateDraft, true).then(handleServerResult);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateDraft(null);
            setDuplicateCandidates([]);
          }
        }}
        open={duplicateCandidates.length > 0}
      />
    </>
  );
}
