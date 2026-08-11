"use client";

import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface JobLinkInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function JobLinkInput({
  value,
  onChange,
  onSubmit,
  disabled
}: JobLinkInputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="job-link-input">
        Job posting URL
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-muted/60 px-4 transition focus-within:border-accent/50 focus-within:bg-surface focus-within:ring-4 focus-within:ring-accent/10">
          <Link2 aria-hidden="true" className="size-5 shrink-0 text-accent" />
        <Input
          className="border-none bg-transparent px-0 py-3 shadow-none focus:bg-transparent focus:ring-0"
          disabled={disabled}
          id="job-link-input"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Paste a job link and press Enter"
          value={value}
        />
        </div>
        <Button disabled={disabled || !value.trim()} onClick={onSubmit} type="button">
          Review job
        </Button>
      </div>
    </div>
  );
}
