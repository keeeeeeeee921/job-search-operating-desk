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
    <div className="rounded-[30px] border border-border bg-white px-4 py-4 shadow-lift">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Textarea
            className="min-h-44 border-none bg-transparent px-0 py-1 text-base shadow-none focus:ring-0"
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Paste job text here. Press Cmd/Ctrl + Enter to process."
            value={value}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Best for LinkedIn Easy Apply and copied job descriptions. Link can stay empty in this mode.
          </p>
        </div>
      </div>
    </div>
  );
}
