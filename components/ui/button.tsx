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
        "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-accent/45 disabled:cursor-not-allowed disabled:opacity-50",
        tone === "default" &&
          "border-accent/20 bg-accent text-accent-foreground shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
        tone === "secondary" &&
          "border-border bg-surface text-foreground hover:border-accent/20 hover:bg-white",
        tone === "ghost" &&
          "border-transparent bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground",
        tone === "danger" &&
          "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        className
      )}
      type={type}
      {...props}
    />
  );
}
