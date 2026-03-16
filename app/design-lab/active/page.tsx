import { DesignLabActive } from "@/components/design-lab/design-lab-active";
import { DesignLabShell } from "@/components/design-lab/design-lab-shell";
import { getJobsPage, searchActiveJobsPage } from "@/lib/db/repository";
import { normalizePageNumber } from "@/lib/job-list";

function readStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DesignLabActivePage({
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
    <DesignLabShell
      currentSection="/design-lab/active"
      description="A/B comparison for the Active page. Both versions use the same query and page data so the difference is strictly visual."
      title="Active Comparison"
    >
      <DesignLabActive pageData={activeJobs} query={query} />
    </DesignLabShell>
  );
}
