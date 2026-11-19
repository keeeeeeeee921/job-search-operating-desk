"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createJobFromLink,
  createJobFromText,
  saveReviewedJob,
  type CreateJobResult
} from "@/app/actions";
import { CaptureBookmarklet } from "@/components/capture-bookmarklet";
import { DailyGoalsWidget } from "@/components/daily-goals-widget";
import { useDemoMode } from "@/components/demo-mode-provider";
import { DuplicateModal } from "@/components/duplicate-modal";
import { JobLinkInput } from "@/components/job-link-input";
import { JobTextInput } from "@/components/job-text-input";
import { ProcessingStatus } from "@/components/processing-status";
import { RecentItemsList } from "@/components/recent-items-list";
import { ReviewModal } from "@/components/review-modal";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  CAPTURE_MESSAGE_TYPE,
  CAPTURE_READY_MESSAGE,
  CAPTURE_WINDOW_NAME,
  parseCapturePayload,
  type CapturePayload
} from "@/lib/capture";
import { toJobListItem } from "@/lib/job-list";
import { useJobDeskStore } from "@/lib/store";
import type {
  DailyGoalsState,
  DuplicateCandidate,
  JobDraft,
  JobListItem
} from "@/lib/types";

type AddJobMode = "link" | "text" | "page";

const addJobModes: { mode: AddJobMode; label: string }[] = [
  { mode: "link", label: "Paste link" },
  { mode: "text", label: "Paste job text" },
  { mode: "page", label: "From open page" }
];

export function HomeWorkspace({
  initialRecentItems,
  initialGoals
}: {
  initialRecentItems: JobListItem[];
  initialGoals: DailyGoalsState;
}) {
  const router = useRouter();
  const demoMode = useDemoMode();
  const pushToast = useJobDeskStore((state) => state.pushToast);

  const [inputMode, setInputMode] = useState<AddJobMode>("link");
  const [linkValue, setLinkValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<JobDraft | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<JobDraft | null>(null);
  const [recentItems, setRecentItems] = useState(initialRecentItems);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateCandidate[]
  >([]);

  const handleServerResult = (result: CreateJobResult) => {
    if (result.status === "blocked") {
      pushToast(result.message, "error");
      setProcessingStatus(null);
      return;
    }

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

  // The bookmarklet opens this page in a window it names (lib/capture.ts).
  // Read the name once: it is cleared below so a later visit in the same tab
  // does not ask the job page again.
  const [openedByBookmarklet] = useState(
    () => typeof window !== "undefined" && window.name === CAPTURE_WINDOW_NAME
  );
  const handleCaptureRef = useRef<(payload: CapturePayload) => void>(() => {});
  handleCaptureRef.current = (payload) => {
    void (async () => {
      setInputMode("page");
      await showProcessingStages([
        "Reading the captured page...",
        "Preparing job record..."
      ]);

      try {
        const response = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: CAPTURE_MESSAGE_TYPE, ...payload })
        });
        const body = (await response.json().catch(() => null)) as
          | CreateJobResult
          | { error?: string }
          | null;

        if (response.ok && body && "status" in body) {
          handleServerResult(body);
          return;
        }

        pushToast(
          (body && "error" in body && body.error) || "Couldn't read the captured page",
          "error"
        );
      } catch {
        pushToast("Couldn't read the captured page", "error");
      }
      setProcessingStatus(null);
    })();
  };

  useEffect(() => {
    if (!openedByBookmarklet || demoMode) {
      return;
    }

    window.name = "";
    const opener = window.opener as Window | null;
    if (!opener) {
      // The job site isolates the windows it opens
      // (Cross-Origin-Opener-Policy), so there is nobody to ask.
      pushToast("That site blocks the hand-off. Use Paste job text instead.", "warning");
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== opener) {
        return;
      }

      const payload = parseCapturePayload(event.data);
      if (!payload) {
        return;
      }

      window.removeEventListener("message", onMessage);
      handleCaptureRef.current(payload);
    };

    window.addEventListener("message", onMessage);
    // Carries no data; the job page answers only if it is waiting for it.
    opener.postMessage(CAPTURE_READY_MESSAGE, "*");

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [demoMode, openedByBookmarklet, pushToast]);

  const handleProcess = async () => {
    if (inputMode === "page") {
      return;
    }

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
        <div className="space-y-6 xl:space-y-5">
          <div className="flex flex-col gap-4 px-1 pb-1 sm:flex-row sm:items-center sm:justify-between xl:gap-3">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground lg:text-5xl xl:text-[2.625rem] xl:leading-[1.08]">
                Keep the working set honest.
              </h1>
            </div>
            <div className="flex justify-center sm:shrink-0 sm:justify-start">
                <Image
                  alt="Animated line drawing of a small office character sitting among papers."
                  className="h-auto w-24 object-contain sm:w-28 xl:w-24"
                  height={128}
                  src="/pool-honest-bear.gif"
                  unoptimized
                  width={128}
                />
            </div>
          </div>

          <Surface className="p-5 sm:p-6 xl:p-5" elevated>
            <h2 className="text-xl font-semibold text-foreground">Add a job</h2>
            {demoMode ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Adding jobs is disabled in the read-only demo. Browse Active, Rejected, and the Search Log instead.
              </p>
            ) : null}
            <div className="mt-6 xl:mt-5">
              <div
                aria-label="Job input mode"
                className="mb-5 inline-flex gap-1 rounded-xl bg-muted p-1 xl:mb-4"
                role="group"
              >
                {addJobModes.map(({ mode, label }) => (
                  <Button
                    aria-pressed={inputMode === mode}
                    className={`rounded-lg border-transparent transition-[background-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-transparent focus:ring-0 focus:ring-offset-0 focus-visible:text-foreground focus-visible:underline focus-visible:decoration-2 focus-visible:decoration-foreground/35 focus-visible:underline-offset-4 focus-visible:ring-0 focus-visible:ring-offset-0 active:translate-y-0 active:scale-[0.98] active:duration-100 ${
                      inputMode === mode
                        ? "shadow-[0_1px_2px_hsl(var(--foreground)/0.08),0_5px_14px_-10px_hsl(var(--foreground)/0.28)] hover:bg-surface"
                        : "shadow-none"
                    }`}
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    tone={inputMode === mode ? "secondary" : "ghost"}
                    type="button"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {inputMode === "link" ? (
                <JobLinkInput
                  disabled={demoMode}
                  onChange={setLinkValue}
                  onSubmit={handleProcess}
                  value={linkValue}
                />
              ) : inputMode === "text" ? (
                <JobTextInput
                  disabled={demoMode}
                  onChange={setTextValue}
                  onSubmit={handleProcess}
                  value={textValue}
                />
              ) : (
                <CaptureBookmarklet disabled={demoMode} />
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
