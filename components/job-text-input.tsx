"use client";

import { FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface JobTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function JobTextInput({
  value,
  onChange,
  onSubmit,
  disabled
}: JobTextInputProps) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-border/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,250,0.86))] px-5 py-5 shadow-lift">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Paste job text
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Best for LinkedIn Easy Apply and copied postings. Link can stay empty here.
              </p>
            </div>
            <div className="hidden rounded-full border border-border/80 bg-white/90 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Enter to process
            </div>
          </div>
          <Textarea
            className="min-h-56 rounded-[26px] border border-border/80 bg-white/90 px-5 py-4 text-[15px] leading-7 shadow-soft focus:border-accent/35 focus:ring-4 focus:ring-accent/10"
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Paste the copied job text here. Press Enter to process, or Shift + Enter for a new line."
            value={value}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            LinkedIn UI noise like Save, Easy Apply, Resume Match, and profile blocks will be ignored when possible.
          </p>
        </div>
      </div>
    </div>
  );
}
