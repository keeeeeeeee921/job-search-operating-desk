import { notFound } from "next/navigation";
import { ActiveDetailPageClient } from "@/components/active-detail-page";
import { getActiveJobById } from "@/lib/db/repository";

export default async function ActiveDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getActiveJobById(id);

  if (!record) {
    notFound();
  }

  return <ActiveDetailPageClient record={record} />;
}
