import { AppShell } from "@/components/app-shell";
import {
  SearchCycleStoryEditor,
  StartSearchCycleButton
} from "@/components/search-cycle-editor";
import { SearchLogPage } from "@/components/search-log-page";
import { getSearchCycles, getSearchLogAnalytics } from "@/lib/db/repository";
import { isPublicDemoMode } from "@/lib/demo-mode";
import { getSearchCycleDateKey } from "@/lib/search-cycle";
import { suggestNextSearchCycleLabel } from "@/lib/search-cycle-form";
import { isCurrentRequestAuthorized } from "@/lib/server/auth";

export default async function JobSearchLogPage() {
  const [analytics, cycles, authorized] = await Promise.all([
    getSearchLogAnalytics(9),
    getSearchCycles(),
    isCurrentRequestAuthorized()
  ]);
  // The public demo shows the controls disabled (the client components read
  // the demo flag); outside the demo they appear only for the token holder.
  const showEditing = isPublicDemoMode() || authorized;

  return (
    <AppShell currentPath="/search-log">
      <SearchLogPage
        analytics={analytics}
        cycles={cycles}
        headerActions={
          showEditing ? (
            <StartSearchCycleButton
              suggestedLabel={suggestNextSearchCycleLabel(cycles)}
              todayKey={getSearchCycleDateKey()}
            />
          ) : undefined
        }
        storyActions={
          showEditing
            ? (cycle) => <SearchCycleStoryEditor cycle={cycle} />
            : undefined
        }
      />
    </AppShell>
  );
}
