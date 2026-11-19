import { NextResponse } from "next/server";
import { CAPTURE_MAX_HTML_CHARS, CAPTURE_MAX_TEXT_CHARS, parseCapturePayload } from "@/lib/capture";
import { getWriteBlock } from "@/lib/server/auth";
import { buildCaptureDraft } from "@/lib/server/capture-service";

// Text and stripped DOM plus JSON escaping; anything larger is not a posting.
const MAX_BODY_CHARS = (CAPTURE_MAX_TEXT_CHARS + CAPTURE_MAX_HTML_CHARS) * 2;

/**
 * Receives a page captured by the bookmarklet (see lib/capture.ts) and
 * answers with a review draft. It never saves: the home page opens the
 * review dialog and saving goes through `saveReviewedJob`, duplicate check
 * included.
 */
export async function POST(request: Request) {
  const blocked = await getWriteBlock();
  if (blocked) {
    return NextResponse.json({ error: blocked.message }, { status: blocked.status });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "The captured page is too large." }, { status: 413 });
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    parsedBody = null;
  }

  const payload = parseCapturePayload(parsedBody);
  if (!payload) {
    return NextResponse.json({ error: "The captured page could not be read." }, { status: 400 });
  }

  const result = buildCaptureDraft(payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ status: "review", draft: result.draft }, { status: 200 });
}
