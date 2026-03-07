import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { archiveJobRecord } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;

  await archiveJobRecord(id);
  revalidatePath("/");
  revalidatePath("/active");
  revalidatePath("/rejected");
  revalidatePath("/search");
  revalidatePath("/update-by-email");
  revalidatePath(`/active/${id}`);

  return NextResponse.json({ ok: true });
}
