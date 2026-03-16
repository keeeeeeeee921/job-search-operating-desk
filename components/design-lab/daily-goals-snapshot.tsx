import { Check, Plus } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import type { DailyGoalsState, GoalKey } from "@/lib/types";

const goalOrder: GoalKey[] = ["apply", "connect", "follow"];

export function DailyGoalsSnapshot({
  goals,
  variant
}: {
  goals: DailyGoalsState;
  variant: "current" | "refined";
}) {
  return (
    <Surface
      className={
        variant === "current"
          ? "overflow-hidden border-white/60 bg-white/70 p-5"
          : "overflow-hidden border-white/60 bg-white/70 p-4"
      }
    >
      <div
        className={
          variant === "current"
            ? "rounded-[28px] border border-white/60 bg-[radial-gradient(circle_at_top_left,rgba(170,165,214,0.22),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,243,249,0.92))] p-5"
            : "rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(167,160,212,0.2),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,241,249,0.92))] p-4"
        }
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Daily Goals
        </p>
        <h2 className={variant === "current" ? "mt-2 text-xl font-semibold text-foreground" : "mt-2 text-lg font-semibold text-foreground"}>
          A quiet progress check-in
        </h2>
        <div className={variant === "current" ? "mt-5 space-y-4" : "mt-4 space-y-3"}>
          {goalOrder.map((goal) => {
            const item = goals.goals[goal];
            const progress = Math.min(item.count / Math.max(item.target, 1), 1);
            const complete = item.count >= item.target;

            return (
              <div
                className={
                  variant === "current"
                    ? "rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-soft"
                    : "rounded-[22px] border border-white/75 bg-white/85 px-4 py-3 shadow-soft"
                }
                key={goal}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.count} / {item.target}
                    </p>
                  </div>
                  <div
                    className={`flex size-9 items-center justify-center rounded-2xl ${
                      complete
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {complete ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className={`h-full rounded-full ${
                      complete ? "bg-emerald-400" : "bg-accent"
                    }`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <div className={variant === "current" ? "mt-4 flex items-center gap-2" : "mt-3 flex items-center gap-2"}>
                  <span className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-surface px-3 text-sm font-semibold text-foreground">
                    <Plus className="mr-1 size-4" />
                    +1
                  </span>
                  <span className="inline-flex h-10 min-w-[90px] items-center justify-center rounded-2xl border border-border bg-white/80 px-4 text-sm text-foreground">
                    {item.target}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
