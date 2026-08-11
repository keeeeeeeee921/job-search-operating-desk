"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div>
      <div className="mb-2 flex items-center gap-2">
        <FileText aria-hidden="true" className="size-4 text-accent" />
        <label className="text-sm font-semibold text-foreground" htmlFor="job-text-input">
          Copied job description
        </label>
      </div>
          <Textarea
            className="min-h-56 px-5 py-4 leading-7"
            disabled={disabled}
            id="job-text-input"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Paste copied job text. Press Enter to process, or Shift+Enter for a new line."
            value={value}
          />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          Best for Easy Apply or copied listings. Press Enter to review, Shift+Enter for a new line.
        </p>
        <Button disabled={disabled || !value.trim()} onClick={onSubmit} type="button">
          Review job
        </Button>
      </div>
    </div>
  );
}
