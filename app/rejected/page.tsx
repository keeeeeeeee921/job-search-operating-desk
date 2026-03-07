import { getJobsByPool } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { ListPageView } from "@/components/list-page-view";

export default async function RejectedPage() {
  const rejectedJobs = await getJobsByPool("rejected");

  return (
    <AppShell currentPath="/rejected">
      <ListPageView
        description="Rejected is a quiet archive. It stays outside the default search flow so the working area remains clean."
        refreshOnMount
        records={rejectedJobs}
        title="Rejected"
      />
    </AppShell>
  );
}
