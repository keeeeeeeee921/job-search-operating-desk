import { AppShell } from "@/components/app-shell";
import { SearchLogPage } from "@/components/search-log-page";

export default function JobSearchLogPage() {
  return (
    <AppShell currentPath="/search-log">
      <SearchLogPage />
    </AppShell>
  );
}
