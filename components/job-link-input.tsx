"use client";

import { Link2 } from "lucide-react";
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
    <div className="rounded-[30px] border border-border bg-white px-4 py-4 shadow-lift">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Link2 className="size-5" />
        </div>
        <Input
          className="border-none bg-transparent px-0 py-2 text-base shadow-none focus:ring-0"
          disabled={disabled}
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
    </div>
  );
}
