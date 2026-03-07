import { getJobsByPool } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { ListPageView } from "@/components/list-page-view";

export default async function ActivePage() {
  const activeJobs = await getJobsByPool("active");

  return (
    <AppShell currentPath="/active">
      <ListPageView
        description="This is the active-only working pool. It stays focused on current applications, sorted by newest first."
        detailBasePath="/active"
        records={activeJobs}
        searchable
        title="Active"
      />
    </AppShell>
  );
}
