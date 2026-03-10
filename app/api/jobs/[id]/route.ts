import { NextResponse } from "next/server";
import { deleteJobRecord } from "@/lib/db/repository";
import { revalidateAfterActiveRecordDeleted } from "@/lib/server/revalidation";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;

  await deleteJobRecord(id);
  revalidateAfterActiveRecordDeleted();

  return NextResponse.json({ ok: true });
}
