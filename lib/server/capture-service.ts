import {
  CAPTURE_MAX_HTML_CHARS,
  CAPTURE_MAX_TEXT_CHARS,
  type CapturePayload
} from "@/lib/capture";
import { buildFallbackExtraction, draftFromExtraction } from "@/lib/extractor";
import { extractCandidatesFromHtml } from "@/lib/server/extraction-service";
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
 * trailing spaces and collapse runs of blank lines. The wording is untouched.
 */
export function normalizeCapturedText(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
 *   posting as shown.
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

  for (const field of identityFields) {
    const fromPage = parsed?.fields[field]?.trim() ?? "";
    const fromLink = fallback.fields[field]?.trim() ?? "";

    fields[field] = fromPage || fromLink;
    fieldOrigins[field] = fromPage ? "confirmed" : fromLink ? "derived" : "missing";
    candidateValues[field] = uniqueValues([
      ...(parsed?.candidateValues[field] ?? []),
      ...(fallback.candidateValues[field] ?? [])
    ]);

    const score = parsed?.confidenceScores?.[field];
    if (fromPage && score !== undefined) {
      confidenceScores[field] = score;
    }
  }

  const pageText = normalizeCapturedText(payload.text);
  // Only when the page gave no visible text at all (an empty selection on a
  // page that renders nothing into <body>) fall back to the description the
  // page itself publishes in its structured data.
  const jobDescription = pageText || parsed?.fields.jobDescription?.trim() || "";
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
