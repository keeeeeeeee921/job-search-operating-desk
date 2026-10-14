import {
  getActiveJobCount,
  getJobsPage,
  searchActiveJobsPage
} from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import {
  ListPageView,
  OLDER_CYCLES_PARAM,
  OLDER_CYCLES_VALUE,
  type SearchCycleView
} from "@/components/list-page-view";
import { normalizePageNumber } from "@/lib/job-list";
import { runStaleArchiveSweepIfDue } from "@/lib/server/stale-archive-sweep";
import { getCurrentSearchCycleLabel } from "@/lib/search-cycle";

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
  const searchCycle =
    readStringParam(params[OLDER_CYCLES_PARAM]) === OLDER_CYCLES_VALUE
      ? "older"
      : "current";

  await runStaleArchiveSweepIfDue();

  const [activeJobs, currentCount, olderCount] = await Promise.all([
    query
      ? searchActiveJobsPage({ query, page, searchCycle })
      : getJobsPage({ pool: "active", page, searchCycle }),
    getActiveJobCount("current"),
    getActiveJobCount("older")
  ]);

  const cycleView: SearchCycleView = {
    mode: searchCycle,
    currentLabel: getCurrentSearchCycleLabel(),
    currentCount,
    olderCount
  };

  return (
    <AppShell currentPath="/active">
      <ListPageView
        basePath="/active"
        cycleView={cycleView}
        description={
          searchCycle === "older"
            ? "Applications from earlier search cycles, sorted newest first."
            : "Your current applications, sorted newest first."
        }
        detailBasePath="/active"
        pageData={activeJobs}
        query={query}
        searchable
        title="Active"
      />
    </AppShell>
  );
}
