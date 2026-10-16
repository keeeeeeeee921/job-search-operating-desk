"use client";

import { useRouter } from "next/navigation";
import {
  useId,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode
} from "react";
import {
  saveSearchCycleStory,
  startSearchCycle,
  type SearchCycleActionResult
} from "@/app/search-cycle-actions";
import { useDemoMode } from "@/components/demo-mode-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo-mode";
import { goalsToText } from "@/lib/search-cycle-form";
import type { SearchCycle } from "@/lib/types";

function readForm(event: FormEvent<HTMLFormElement>) {
  const values: Record<string, string> = {};
  for (const [key, value] of new FormData(event.currentTarget).entries()) {
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

function Field({
  label,
  hint,
  htmlFor,
  children
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Shared submit plumbing: runs the server action in a transition, surfaces
 * its error inline, and refreshes the server-rendered page on success.
 */
function useCycleForm(onSaved: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (run: () => Promise<SearchCycleActionResult>) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await run();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSaved();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save.");
      }
    });
  };

  return { pending, error, setError, submit };
}

export function SearchCycleStoryEditor({ cycle }: { cycle: SearchCycle }) {
  const demoMode = useDemoMode();
  const [open, setOpen] = useState(false);
  const ids = useId();
  const { pending, error, setError, submit } = useCycleForm(() => setOpen(false));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = readForm(event);
    submit(() => saveSearchCycleStory(cycle.id, values));
  };

  return (
    <>
      <Button
        aria-label={`Edit ${cycle.label} story`}
        disabled={demoMode}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title={demoMode ? DEMO_READ_ONLY_MESSAGE : undefined}
        tone="secondary"
      >
        Edit
      </Button>
      <Dialog
        className="h-auto max-h-[92dvh] sm:h-auto sm:max-h-[88dvh]"
        description="The title, goals and note show on this page; the dates decide which records belong to the cycle."
        onOpenChange={setOpen}
        open={open}
        title={`Edit ${cycle.label}`}
      >
        <form
          className="grid max-h-[calc(88dvh-140px)] min-h-0 grid-rows-[minmax(0,1fr)_auto]"
          onSubmit={onSubmit}
        >
          <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain pb-4 pr-1">
            <Field htmlFor={`${ids}-title`} label="Title">
              <Input
                defaultValue={cycle.title}
                id={`${ids}-title`}
                maxLength={200}
                name="title"
                placeholder="First full-time search after graduation"
              />
            </Field>
            <Field
              hint="One goal per line."
              htmlFor={`${ids}-goals`}
              label="Main goals"
            >
              <Textarea
                className="min-h-24"
                defaultValue={goalsToText(cycle.goals)}
                id={`${ids}-goals`}
                name="goals"
                placeholder={"Find a job\nKeep some data analysis content in the role"}
              />
            </Field>
            <Field htmlFor={`${ids}-note`} label="Approach">
              <Textarea
                defaultValue={cycle.note}
                id={`${ids}-note`}
                maxLength={4000}
                name="note"
                placeholder="How this search was run and what it optimised for."
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                hint="Records saved on or after this day belong here."
                htmlFor={`${ids}-start`}
                label="Start date"
              >
                <Input
                  defaultValue={cycle.startDate}
                  id={`${ids}-start`}
                  name="startDate"
                  required
                  type="date"
                />
              </Field>
              <Field
                hint="Leave empty while the search is still running."
                htmlFor={`${ids}-end`}
                label="End date"
              >
                <Input
                  defaultValue={cycle.endDate ?? ""}
                  id={`${ids}-end`}
                  name="endDate"
                  type="date"
                />
              </Field>
            </div>
            <Field
              hint="A file in public/ (e.g. /job-search-cycle-01.png) or an https:// URL."
              htmlFor={`${ids}-image`}
              label="Summary image"
            >
              <Input
                defaultValue={cycle.imageSrc ?? ""}
                id={`${ids}-image`}
                maxLength={500}
                name="imageSrc"
                placeholder="/job-search-cycle-02.png"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className="text-sm text-rose-700" role={error ? "alert" : undefined}>
              {error}
            </p>
            <div className="flex justify-end gap-2">
              <Button disabled={pending} onClick={() => setOpen(false)} tone="ghost">
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? "Saving…" : "Save story"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function StartSearchCycleButton({
  suggestedLabel,
  todayKey
}: {
  suggestedLabel: string;
  todayKey: string;
}) {
  const demoMode = useDemoMode();
  const [open, setOpen] = useState(false);
  const ids = useId();
  const { pending, error, setError, submit } = useCycleForm(() => setOpen(false));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = readForm(event);
    submit(() => startSearchCycle(values));
  };

  return (
    <>
      <Button
        disabled={demoMode}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title={demoMode ? DEMO_READ_ONLY_MESSAGE : undefined}
      >
        Start a new search cycle
      </Button>
      <Dialog
        className="h-auto max-w-[560px] sm:h-auto"
        description="From the start date on, newly saved records belong to the new cycle and Active shows it by default. The previous cycle is closed the day before."
        onOpenChange={setOpen}
        open={open}
        title="Start a new search cycle"
      >
        <form className="space-y-5" onSubmit={onSubmit}>
          <Field htmlFor={`${ids}-label`} label="Label">
            <Input
              defaultValue={suggestedLabel}
              id={`${ids}-label`}
              maxLength={32}
              name="label"
              required
            />
          </Field>
          <Field
            hint="Must be after the previous cycle started and no later than today."
            htmlFor={`${ids}-start`}
            label="Start date"
          >
            <Input
              defaultValue={todayKey}
              id={`${ids}-start`}
              max={todayKey}
              name="startDate"
              required
              type="date"
            />
          </Field>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className="text-sm text-rose-700" role={error ? "alert" : undefined}>
              {error}
            </p>
            <div className="flex justify-end gap-2">
              <Button disabled={pending} onClick={() => setOpen(false)} tone="ghost">
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? "Starting…" : "Start cycle"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
