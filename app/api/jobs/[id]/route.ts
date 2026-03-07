import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteJobRecord } from "@/lib/db/repository";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;

  await deleteJobRecord(id);
  revalidatePath("/");
  revalidatePath("/active");
  revalidatePath("/rejected");
  revalidatePath("/search");
  revalidatePath("/update-by-email");
  revalidatePath(`/active/${id}`);

  return NextResponse.json({ ok: true });
}
