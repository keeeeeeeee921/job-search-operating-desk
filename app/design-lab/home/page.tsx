import { getDailyGoalsState, getRecentActiveJobs } from "@/lib/db/repository";
import { DesignLabHome } from "@/components/design-lab/design-lab-home";
import { DesignLabShell } from "@/components/design-lab/design-lab-shell";

export default async function DesignLabHomePage() {
  const [recentItems, dailyGoals] = await Promise.all([
    getRecentActiveJobs(4),
    getDailyGoalsState()
  ]);

  return (
    <DesignLabShell
      currentSection="/design-lab/home"
      description="A/B comparison for the homepage using real recent items and current goals, but with safe read-only snapshots."
      title="Home Comparison"
    >
      <DesignLabHome goals={dailyGoals} recentItems={recentItems} />
    </DesignLabShell>
  );
}
