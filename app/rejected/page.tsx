import { getJobsPage } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { ListPageView } from "@/components/list-page-view";
import { normalizePageNumber } from "@/lib/job-list";

function readStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function RejectedPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const page = normalizePageNumber(Number(readStringParam(params.page)));
  const rejectedJobs = await getJobsPage({ pool: "rejected", page });

  return (
    <AppShell currentPath="/rejected">
      <ListPageView
        basePath="/rejected"
        description="Archived applications that are no longer active."
        pageData={rejectedJobs}
        title="Rejected"
      />
    </AppShell>
  );
}
