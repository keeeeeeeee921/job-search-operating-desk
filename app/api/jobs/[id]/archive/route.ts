import { NextResponse } from "next/server";
import { archiveJobRecord } from "@/lib/db/repository";
import { revalidateAfterActiveRecordArchived } from "@/lib/server/revalidation";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;

  await archiveJobRecord(id);
  revalidateAfterActiveRecordArchived();

  return NextResponse.json({ ok: true });
}
