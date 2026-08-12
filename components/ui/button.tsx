"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "secondary" | "ghost" | "danger";
}

export function Button({
  className,
  tone = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-1 focus-visible:ring-offset-surface active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        tone === "default" &&
          "border-accent bg-accent text-accent-foreground hover:bg-accent/90",
        tone === "secondary" &&
          "border-border bg-surface text-foreground hover:border-accent/35 hover:bg-muted",
        tone === "ghost" &&
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        tone === "danger" &&
          "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        className
      )}
      type={type}
      {...props}
    />
  );
}
