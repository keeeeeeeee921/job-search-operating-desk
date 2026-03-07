"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJobFromLink, saveReviewedJob } from "@/app/actions";
import { DailyGoalsWidget } from "@/components/daily-goals-widget";
import { DuplicateModal } from "@/components/duplicate-modal";
import { JobLinkInput } from "@/components/job-link-input";
import { ProcessingStatus } from "@/components/processing-status";
import { RecentItemsList } from "@/components/recent-items-list";
import { ReviewModal } from "@/components/review-modal";
import { Surface } from "@/components/ui/surface";
import { useJobDeskStore } from "@/lib/store";
import type {
  DailyGoalsState,
  DuplicateCandidate,
  JobDraft,
  JobRecord
} from "@/lib/types";

export function HomeWorkspace({
  initialRecentItems,
  initialGoals
}: {
  initialRecentItems: JobRecord[];
  initialGoals: DailyGoalsState;
}) {
  const router = useRouter();
  const pushToast = useJobDeskStore((state) => state.pushToast);

  const [inputValue, setInputValue] = useState("");
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
      pushToast("Missing fields need review", "warning");
      setProcessingStatus(null);
      return;
    }

    if (result.status === "duplicate") {
      setDuplicateDraft(result.draft);
      setDuplicateCandidates(result.candidates);
      pushToast("Possible duplicate found", "warning");
      setProcessingStatus(null);
      return;
    }

    setRecentItems((current) => [result.record, ...current].slice(0, 4));
    pushToast("Added to Active", "success");
    setProcessingStatus(null);
    setInputValue("");
    setReviewDraft(null);
    setDuplicateDraft(null);
    setDuplicateCandidates([]);
    router.refresh();
  };

  const handleProcess = async () => {
    if (!inputValue.trim()) {
      return;
    }

    setProcessingStatus("Processing...");
    setProcessingStatus("Detecting source...");
    setProcessingStatus("Preparing job record...");
    setProcessingStatus("Checking duplicates...");
    handleServerResult(await createJobFromLink(inputValue));
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Surface className="p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Main Input
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
              Paste a job link. Keep the working pool honest.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This desk separates input, extraction, and saved records. If required fields are missing or the source is restricted, the app stops and asks for review instead of pretending extraction succeeded.
            </p>
            <div className="mt-6">
              <JobLinkInput
                disabled={false}
                onChange={setInputValue}
                onSubmit={handleProcess}
                value={inputValue}
              />
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
