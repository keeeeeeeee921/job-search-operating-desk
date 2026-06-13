import { AppShell } from "@/components/app-shell";
import { SearchLogPage } from "@/components/search-log-page";
import { getSearchLogAnalytics } from "@/lib/db/repository";

export default async function JobSearchLogPage() {
  const analytics = await getSearchLogAnalytics(9);

  return (
    <AppShell currentPath="/search-log">
      <SearchLogPage analytics={analytics} />
    </AppShell>
  );
}
