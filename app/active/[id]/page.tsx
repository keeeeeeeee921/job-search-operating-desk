import { notFound } from "next/navigation";
import { ActiveDetailPageClient } from "@/components/active-detail-page";
import {
  buildListHref,
  OLDER_CYCLES_PARAM,
  OLDER_CYCLES_VALUE
} from "@/components/list-page-view";
import { getActiveJobById } from "@/lib/db/repository";

function readStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ActiveDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const listParams = searchParams ? await searchParams : {};
  const record = await getActiveJobById(id);

  if (!record) {
    notFound();
  }

  // Detail links carry the list view they came from, so Back returns there.
  const backHref = buildListHref("/active", {
    olderCycles: readStringParam(listParams[OLDER_CYCLES_PARAM]) === OLDER_CYCLES_VALUE,
    query: readStringParam(listParams.q),
    page: Number(readStringParam(listParams.page)) || undefined
  });

  return <ActiveDetailPageClient backHref={backHref} record={record} />;
}
