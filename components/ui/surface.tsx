import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({
  className,
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface",
        elevated && "shadow-soft",
        className
      )}
      {...props}
    />
  );
}
