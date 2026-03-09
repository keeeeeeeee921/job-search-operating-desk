import {
  getJobsPage,
  searchActiveJobsPage
} from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { ListPageView } from "@/components/list-page-view";
import { normalizePageNumber } from "@/lib/job-list";

function readStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ActivePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = readStringParam(params.q).trim();
  const page = normalizePageNumber(Number(readStringParam(params.page)));
  const activeJobs = query
    ? await searchActiveJobsPage({ query, page })
    : await getJobsPage({ pool: "active", page });

  return (
    <AppShell currentPath="/active">
      <ListPageView
        basePath="/active"
        description="This is the active-only working pool. It stays focused on current applications, sorted by newest first."
        detailBasePath="/active"
        pageData={activeJobs}
        query={query}
        searchable
        title="Active"
      />
    </AppShell>
  );
}
