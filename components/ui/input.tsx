import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-border bg-muted/60 px-4 py-3 text-base text-foreground outline-none transition duration-200 placeholder:text-muted-foreground focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10 sm:text-sm",
        className
      )}
      {...props}
    />
  );
}
