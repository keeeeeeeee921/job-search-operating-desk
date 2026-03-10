import { permanentRedirect } from "next/navigation";

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
  const page = readStringParam(params.page).trim();
  const nextParams = new URLSearchParams();

  if (query) {
    nextParams.set("q", query);
  }

  if (page && page !== "1") {
    nextParams.set("page", page);
  }

  const target = nextParams.toString()
    ? `/active?${nextParams.toString()}`
    : "/active";
  permanentRedirect(target);
}
