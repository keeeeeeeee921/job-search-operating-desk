import { searchActiveJobsPage } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { ListPageView } from "@/components/list-page-view";
import { normalizePageNumber } from "@/lib/job-list";

function readStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = readStringParam(params.q).trim();
  const page = normalizePageNumber(Number(readStringParam(params.page)));
  const activeJobs = await searchActiveJobsPage({ query, page });

  return (
    <AppShell currentPath="/search">
      <ListPageView
        basePath="/search"
        description="Search scans only Active records. Use company, role title, or both together."
        detailBasePath="/active"
        pageData={activeJobs}
        query={query}
        searchable
        searchPlaceholder="Search Active by company, role title, or both"
        title="Search"
      />
    </AppShell>
  );
}
