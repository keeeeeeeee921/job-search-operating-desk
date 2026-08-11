"use client";

import { startTransition, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { updateDailyGoal } from "@/app/actions";
import { Surface } from "@/components/ui/surface";
import type { DailyGoalsState, GoalKey } from "@/lib/types";

const goalOrder: GoalKey[] = ["apply", "connect", "follow"];

export function DailyGoalsWidget({
  initialGoals
}: {
  initialGoals: DailyGoalsState;
}) {
  const [dailyGoals, setDailyGoals] = useState(initialGoals);

  useEffect(() => {
    setDailyGoals(initialGoals);
  }, [initialGoals]);

  return (
    <Surface className="p-5">
      <h2 className="text-xl font-semibold text-foreground">Daily check-in</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Small targets, one clear action each.
      </p>
      <div className="mt-4 divide-y divide-border">
        {goalOrder.map((goal) => {
          const item = dailyGoals.goals[goal];
          return (
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-1 last:pb-0"
              key={goal}
            >
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {item.count} / {item.target}
                </p>
              </div>
              <button
                aria-label={`Add one ${item.label.toLowerCase()}`}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:translate-y-px"
                onClick={() =>
                  startTransition(async () => {
                    setDailyGoals(
                      await updateDailyGoal({
                        goal,
                        kind: "increment"
                      })
                    );
                  })
                }
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
