import type { ReactNode } from "react";
import { Surface } from "@/components/ui/surface";

export function DesignLabSection({
  variant,
  title,
  notes,
  children
}: {
  variant: "current" | "refined";
  title: string;
  notes: string[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {variant === "current" ? "Current" : "Refined"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {notes.map((note) => (
            <span
              className="rounded-full border border-border/80 bg-white/80 px-3 py-1 text-xs text-muted-foreground"
              key={note}
            >
              {note}
            </span>
          ))}
        </div>
      </div>
      <Surface
        className={
          variant === "current"
            ? "p-0"
            : "overflow-hidden border-accent/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,243,251,0.9))] p-0 shadow-lift"
        }
      >
        {children}
      </Surface>
    </section>
  );
}
