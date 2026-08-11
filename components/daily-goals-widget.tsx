"use client";

import { startTransition, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { updateDailyGoal } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import type { DailyGoalsState, GoalKey } from "@/lib/types";

const goalOrder: GoalKey[] = ["apply", "connect", "follow"];

export function DailyGoalsWidget({
  initialGoals
}: {
  initialGoals: DailyGoalsState;
}) {
  const [dailyGoals, setDailyGoals] = useState(initialGoals);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDailyGoals(initialGoals);
    setTargetDrafts({});
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
                className="py-4 first:pt-2 last:pb-0"
                key={goal}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {item.count} / {item.target}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                  <Button
                    aria-label={`Add one ${item.label.toLowerCase()}`}
                    className="h-10 px-3"
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
                    tone="secondary"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Add one
                  </Button>
                  <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
                    Target
                    <Input
                      aria-label={`${item.label} target`}
                      className="h-10 text-center"
                      inputMode="numeric"
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isNaN(value) && value > 0) {
                          startTransition(async () => {
                            setDailyGoals(
                              await updateDailyGoal({
                                goal,
                                kind: "target",
                                value
                              })
                            );
                          });
                        }
                      }}
                      onChange={(event) =>
                        setTargetDrafts((current) => ({
                          ...current,
                          [goal]: event.target.value
                        }))
                      }
                      value={targetDrafts[goal] ?? String(item.target)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
    </Surface>
  );
}
