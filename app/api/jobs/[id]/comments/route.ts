import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateComments } from "@/lib/db/repository";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | { comments?: unknown }
    | null;
  const comments =
    typeof payload?.comments === "string" ? payload.comments : null;

  if (!comments && comments !== "") {
    return NextResponse.json(
      { error: "Comments must be a string." },
      { status: 400 }
    );
  }

  await updateComments(id, comments);
  revalidatePath("/");
  revalidatePath("/active");
  revalidatePath("/search");
  revalidatePath(`/active/${id}`);

  return NextResponse.json({ ok: true });
}
