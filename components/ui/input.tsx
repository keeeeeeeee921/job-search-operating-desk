import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground shadow-soft outline-none transition duration-200 placeholder:text-muted-foreground focus:border-accent/40 focus:ring-4 focus:ring-accent/10",
        className
      )}
      {...props}
    />
  );
}
