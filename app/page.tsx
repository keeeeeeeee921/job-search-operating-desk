import { getDailyGoalsState, getRecentActiveJobs } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { HomeWorkspace } from "@/components/home-workspace";

export default async function HomePage() {
  const [recentItems, dailyGoals] = await Promise.all([
    getRecentActiveJobs(4),
    getDailyGoalsState()
  ]);

  return (
    <AppShell currentPath="/">
      <HomeWorkspace initialGoals={dailyGoals} initialRecentItems={recentItems} />
    </AppShell>
  );
}
