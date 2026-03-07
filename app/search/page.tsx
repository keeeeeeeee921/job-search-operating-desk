import { getJobsByPool } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { ListPageView } from "@/components/list-page-view";

export default async function SearchPage() {
  const activeJobs = await getJobsByPool("active");

  return (
    <AppShell currentPath="/search">
      <ListPageView
        description="Search scans only Active records. Use company, role title, or both together."
        detailBasePath="/active"
        records={activeJobs}
        searchable
        searchPlaceholder="Search Active by company, role title, or both"
        title="Search"
      />
    </AppShell>
  );
}
