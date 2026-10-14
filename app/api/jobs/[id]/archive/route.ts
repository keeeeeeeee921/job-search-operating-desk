import { NextResponse } from "next/server";
import { archiveJobRecord } from "@/lib/db/repository";
import { getWriteBlock } from "@/lib/server/auth";
import { revalidateAfterActiveRecordArchived } from "@/lib/server/revalidation";

export async function POST(
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

  await archiveJobRecord(id);
  revalidateAfterActiveRecordArchived();

  return NextResponse.json({ ok: true });
}
