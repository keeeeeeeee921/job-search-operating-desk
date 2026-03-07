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
import { useJobDeskStore } from "@/lib/store";
import type {
  DailyGoalsState,
  DuplicateCandidate,
  InputMode,
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
    setLinkValue("");
    setTextValue("");
    setReviewDraft(null);
    setDuplicateDraft(null);
    setDuplicateCandidates([]);
    router.refresh();
  };

  const handleProcess = async () => {
    const activeValue = inputMode === "link" ? linkValue : textValue;
    if (!activeValue.trim()) {
      return;
    }

    if (inputMode === "link") {
      setProcessingStatus("Processing...");
      setProcessingStatus("Detecting source...");
      setProcessingStatus("Preparing job record...");
      setProcessingStatus("Checking duplicates...");
      handleServerResult(await createJobFromLink(linkValue));
      return;
    }

    setProcessingStatus("Processing...");
    setProcessingStatus("Parsing pasted job text...");
    setProcessingStatus("Preparing job record...");
    setProcessingStatus("Checking duplicates...");
    handleServerResult(await createJobFromText(textValue));
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Surface className="p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Main Input
            </p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
              <div className="max-w-[980px] flex-1">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground xl:text-[3.35rem] xl:leading-[1.02]">
                  Paste a job link. Keep the working pool honest.
                </h1>
              </div>
              <div className="flex justify-center lg:shrink-0 lg:justify-start">
                <Image
                  alt="A bear sitting in an office chair surrounded by paper stacks."
                  className="h-auto w-20 object-contain sm:w-24 lg:w-28"
                  height={128}
                  src="/pool-honest-bear.gif"
                  unoptimized
                  width={128}
                />
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This desk separates input, extraction, and saved records. If required fields are missing or the source is restricted, the app stops and asks for review instead of pretending extraction succeeded.
            </p>
            <div className="mt-6">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => setInputMode("link")}
                  tone={inputMode === "link" ? "default" : "ghost"}
                  type="button"
                >
                  Paste link
                </Button>
                <Button
                  onClick={() => setInputMode("text")}
                  tone={inputMode === "text" ? "default" : "ghost"}
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
