import {
  CAPTURE_MAX_HTML_CHARS,
  CAPTURE_MAX_TEXT_CHARS,
  type CapturePayload
} from "@/lib/capture";
import { buildFallbackExtraction, draftFromExtraction } from "@/lib/extractor";
import { extractCandidatesFromHtml } from "@/lib/server/extraction-service";
import { extractJobFromText } from "@/lib/text-extractor";
import type {
  ExtractionResult,
  FieldOrigin,
  JobDraft,
  JobField
} from "@/lib/types";
import { normalizeUrl, uniqueValues } from "@/lib/utils";

const identityFields = ["roleTitle", "company", "location"] as const;

export type CaptureDraftResult =
  | { ok: true; draft: JobDraft }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Tidy the rendered text without rewriting it: unify line endings, drop
 * invisible zero-width characters and trailing spaces, and collapse runs of
 * blank lines. The wording is untouched.
 */
export function normalizeCapturedText(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\ufeff]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Shorter than this, a "description" is a teaser, not the posting body. */
const MIN_BODY_CHARS = 400;
const ANCHOR_CHARS = 48;

function compactWithOffsets(value: string) {
  let compact = "";
  const offsets: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (/\s/.test(char)) {
      continue;
    }

    const lower = char.toLowerCase();
    compact += lower.length === 1 ? lower : char;
    offsets.push(index);
  }

  return { compact, offsets };
}

/**
 * Find the posting body inside the page's rendered text.
 *
 * A captured page starts and ends with things that are not the posting (skip
 * links, "Sign In", the footer). `description` is the body the page itself
 * publishes (JSON-LD or its description element), which the parser flattens
 * to one line; it is used only to find where the body starts and ends. What
 * is returned is the rendered text between those two points, line breaks and
 * wording as shown.
 *
 * Returns null, leaving the whole page text in place, unless the match is
 * unambiguous: the description is body-sized, both ends are found, the text
 * between them is the same amount of text as the description, and it is at
 * least half the page. A teaser or a partial description therefore never
 * shortens what is saved.
 */
export function locatePostingBody(pageText: string, description: string) {
  const needle = compactWithOffsets(description).compact;
  if (needle.length < MIN_BODY_CHARS) {
    return null;
  }

  const { compact, offsets } = compactWithOffsets(pageText);
  const head = needle.slice(0, ANCHOR_CHARS);
  const tail = needle.slice(-ANCHOR_CHARS);
  const start = compact.indexOf(head);
  const tailAt = compact.lastIndexOf(tail);
  if (start === -1 || tailAt < start) {
    return null;
  }

  const end = tailAt + tail.length - 1;
  const span = end - start + 1;
  if (
    Math.abs(span - needle.length) > needle.length * 0.1 ||
    span < compact.length * 0.5
  ) {
    return null;
  }

  return pageText.slice(offsets[start], (offsets[end] ?? pageText.length - 1) + 1).trim();
}

function normalizeCaptureUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return normalizeUrl(rawUrl);
}

/**
 * Turn a page captured in the browser into a review draft.
 *
 * - Role title, company and location come from the captured DOM through the
 *   same generic parser the "Paste link" path uses (JSON-LD, meta tags,
 *   headings). Anything it cannot find falls back to URL hints, which stay
 *   flagged as "From link" until a person confirms them.
 * - The job description is the page's rendered text, not the parser's pick:
 *   meta descriptions are often a teaser, and the reader asked for the
 *   posting as shown. When the page marks its own posting body, the text is
 *   cut to that body (see locatePostingBody); otherwise it is kept whole.
 * - A location the DOM does not give is looked for in the visible text with
 *   the "Paste job text" parser, so "locations / St. Louis, MO" on the page
 *   is found even when the structured data holds an internal site code.
 * - No network request is made here; the server only parses what it was sent.
 */
export function buildCaptureDraft(payload: CapturePayload): CaptureDraftResult {
  const normalizedUrl = normalizeCaptureUrl(payload.url);
  if (!normalizedUrl) {
    return { ok: false, status: 400, error: "The captured page URL is not a valid web address." };
  }

  if (payload.text.length > CAPTURE_MAX_TEXT_CHARS) {
    return {
      ok: false,
      status: 413,
      error: "The captured page text is too long. Select the posting text and try again."
    };
  }

  const fallback = buildFallbackExtraction(normalizedUrl);
  let parsed: ExtractionResult | null = null;
  if (payload.html.trim()) {
    try {
      parsed = extractCandidatesFromHtml(
        payload.html.slice(0, CAPTURE_MAX_HTML_CHARS),
        normalizedUrl
      );
    } catch {
      parsed = null;
    }
  }

  const fields: Partial<Record<JobField, string>> = { link: normalizedUrl };
  const fieldOrigins: Partial<Record<JobField, FieldOrigin>> = { link: "confirmed" };
  const candidateValues: Partial<Record<JobField, string[]>> = {};
  const confidenceScores: Partial<Record<JobField, number>> = {};

  const pageText = normalizeCapturedText(payload.text);
  const fromText = pageText ? extractJobFromText(pageText) : null;

  for (const field of identityFields) {
    const fromDom = parsed?.fields[field]?.trim() ?? "";
    // Only the location is taken from the visible text: the title and
    // company guesses of the text parser assume a pasted posting, not a
    // whole page with navigation above it.
    const fromVisibleText =
      field === "location" ? fromText?.fields.location?.trim() ?? "" : "";
    const fromPage = fromDom || fromVisibleText;
    const fromLink = fallback.fields[field]?.trim() ?? "";

    fields[field] = fromPage || fromLink;
    fieldOrigins[field] = fromPage ? "confirmed" : fromLink ? "derived" : "missing";
    candidateValues[field] = uniqueValues([
      ...(parsed?.candidateValues[field] ?? []),
      ...(field === "location" ? fromText?.candidateValues.location ?? [] : []),
      ...(fallback.candidateValues[field] ?? [])
    ]);

    const score = fromDom
      ? parsed?.confidenceScores?.[field]
      : fromVisibleText
        ? fromText?.confidenceScores?.location
        : undefined;
    if (score !== undefined) {
      confidenceScores[field] = score;
    }
  }

  let postingBody: string | null = null;
  for (const description of parsed?.candidateValues.jobDescription ?? []) {
    postingBody = locatePostingBody(pageText, description);
    if (postingBody) {
      break;
    }
  }
  // Only when the page gave no visible text at all (an empty selection on a
  // page that renders nothing into <body>) fall back to the description the
  // page itself publishes in its structured data.
  const jobDescription =
    postingBody || pageText || parsed?.fields.jobDescription?.trim() || "";
  fields.jobDescription = jobDescription;
  fieldOrigins.jobDescription = jobDescription ? "confirmed" : "missing";
  candidateValues.jobDescription = jobDescription ? [jobDescription] : [];

  const result: ExtractionResult = {
    normalizedUrl,
    inputMode: "link",
    sourceType: fallback.sourceType,
    sourceConfidence: fallback.sourceConfidence,
    confidenceScores,
    extractionStatus: "needs_review",
    supported: true,
    fields,
    fieldOrigins,
    candidateValues,
    issues: [],
    notes: ["Captured from the page open in the browser."]
  };

  return { ok: true, draft: draftFromExtraction(result) };
}
