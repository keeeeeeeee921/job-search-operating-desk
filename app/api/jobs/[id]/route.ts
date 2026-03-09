import { NextResponse } from "next/server";
import { deleteJobRecord } from "@/lib/db/repository";
import { revalidateAfterActiveRecordRemoved } from "@/lib/server/revalidation";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;

  await deleteJobRecord(id);
  revalidateAfterActiveRecordRemoved(id);

  return NextResponse.json({ ok: true });
}
