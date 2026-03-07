import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface/90 shadow-soft backdrop-blur",
        className
      )}
      {...props}
    />
  );
}
