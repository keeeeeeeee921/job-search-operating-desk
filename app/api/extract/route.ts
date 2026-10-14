import { NextResponse } from "next/server";
import { buildFallbackExtraction } from "@/lib/extractor";
import { getWriteBlock } from "@/lib/server/auth";
import { extractJobOnServer } from "@/lib/server/extraction-service";
import { normalizeUrl } from "@/lib/utils";

export async function POST(request: Request) {
  const blocked = await getWriteBlock();
  if (blocked) {
    return NextResponse.json({ error: blocked.message }, { status: blocked.status });
  }

  const rawBody = await request.text();
  let body: { url?: string } = {};
  if (rawBody) {
    try {
      body = (JSON.parse(rawBody) as { url?: string }) ?? {};
    } catch {
      body = {};
    }
  }
  const normalizedUrl = normalizeUrl(body.url ?? "");

  if (!normalizedUrl) {
    return NextResponse.json(buildFallbackExtraction(body.url ?? ""), {
      status: 200
    });
  }
  return NextResponse.json(await extractJobOnServer(normalizedUrl), {
    status: 200
  });
}
