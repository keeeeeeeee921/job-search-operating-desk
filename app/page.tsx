import { getDailyGoalsState, getRecentActiveJobs } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { HomeWorkspace } from "@/components/home-workspace";
import { runStaleArchiveSweepIfDue } from "@/lib/server/stale-archive-sweep";

export default async function HomePage() {
  await runStaleArchiveSweepIfDue();

  const [recentItems, dailyGoals] = await Promise.all([
    getRecentActiveJobs(4, "current"),
    getDailyGoalsState()
  ]);

  return (
    <AppShell currentPath="/">
      <HomeWorkspace initialGoals={dailyGoals} initialRecentItems={recentItems} />
    </AppShell>
  );
}
