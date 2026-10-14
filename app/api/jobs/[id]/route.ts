import { NextResponse } from "next/server";
import { deleteJobRecord } from "@/lib/db/repository";
import { getWriteBlock } from "@/lib/server/auth";
import { revalidateAfterActiveRecordDeleted } from "@/lib/server/revalidation";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const blocked = await getWriteBlock();
  if (blocked) {
    return NextResponse.json({ error: blocked.message }, { status: blocked.status });
  }

  const { id } = await context.params;

  await deleteJobRecord(id);
  revalidateAfterActiveRecordDeleted();

  return NextResponse.json({ ok: true });
}
