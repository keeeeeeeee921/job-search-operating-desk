import { AppShell } from "@/components/app-shell";
import { SearchLogPage } from "@/components/search-log-page";
import { getSearchCycles, getSearchLogAnalytics } from "@/lib/db/repository";

export default async function JobSearchLogPage() {
  const [analytics, cycles] = await Promise.all([
    getSearchLogAnalytics(9),
    getSearchCycles()
  ]);

  return (
    <AppShell currentPath="/search-log">
      <SearchLogPage analytics={analytics} cycles={cycles} />
    </AppShell>
  );
}
