import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isPublicDemo } from "@/lib/demo";
import { resetCurrentEnvironmentToSeedState } from "@/lib/db/repository";

const revalidatedPaths = ["/", "/active", "/rejected", "/search", "/update-by-email"];

function isAuthorized(request: NextRequest) {
  return request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isPublicDemo()) {
    return NextResponse.json({ ok: true, skipped: "not-demo" });
  }

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is required for demo resets." },
      { status: 500 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await resetCurrentEnvironmentToSeedState();

  for (const path of revalidatedPaths) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, reset: true });
}
