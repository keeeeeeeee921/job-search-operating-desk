"use client";

import { startTransition, useState } from "react";
import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
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

  return (
    <Surface className="overflow-hidden border-white/60 bg-white/70 p-5">
      <div className="rounded-[28px] border border-white/60 bg-[radial-gradient(circle_at_top_left,rgba(170,165,214,0.22),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,243,249,0.92))] p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Daily Goals
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          A quiet progress check-in
        </h2>
        <div className="mt-5 space-y-4">
          {goalOrder.map((goal) => {
            const item = dailyGoals.goals[goal];
            const progress = Math.min(item.count / Math.max(item.target, 1), 1);
            const complete = item.count >= item.target;
            return (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-soft"
                initial={{ opacity: 0, y: 10 }}
                key={goal}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
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
                  <motion.div
                    animate={{ width: `${progress * 100}%` }}
                    className={`h-full rounded-full ${
                      complete ? "bg-emerald-400" : "bg-accent"
                    }`}
                    initial={false}
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    className="h-10 rounded-2xl px-3"
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
                    <Plus className="mr-1 size-4" />
                    +1
                  </Button>
                  <Input
                    className="h-10 rounded-2xl bg-white/80 text-center"
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
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
