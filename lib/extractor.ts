import {
  type ExtractionResult,
  type FieldOrigin,
  type JobDraft,
  type JobField
} from "@/lib/types";
import { validateJobDraft } from "@/lib/recordValidation";
import { detectSource } from "@/lib/sourceDetection";
import {
  capitalizeWords,
  hostToCompany,
  normalizeUrl,
  uniqueValues
} from "@/lib/utils";

type PartialFieldMap = Partial<Record<JobField, string>>;

function emptyFieldOrigins(): Partial<Record<JobField, FieldOrigin>> {
  return {
    roleTitle: "missing",
    company: "missing",
    location: "missing",
    link: "missing",
    jobDescription: "missing"
  };
}

function deriveFromUrl(normalizedUrl: string): {
  fields: PartialFieldMap;
  fieldOrigins: Partial<Record<JobField, FieldOrigin>>;
  candidateValues: Partial<Record<JobField, string[]>>;
} {
  const parsed = new URL(normalizedUrl);
  const slug = parsed.pathname
    .split("/")
    .filter(Boolean)
    .slice(-2)
    .join(" ");
  const cleanedSlug = slug.replace(/[-_]/g, " ").trim();
  const probableRole = cleanedSlug
    .replace(/\b(job|jobs|careers|career|apply|detail|listing)\b/gi, "")
    .trim();
  const companyCandidate = hostToCompany(parsed.hostname);

  const fields: PartialFieldMap = {
    link: normalizedUrl,
    company: companyCandidate || "",
    roleTitle: probableRole ? capitalizeWords(probableRole) : "",
    location: "",
    jobDescription: ""
  };

  const fieldOrigins = emptyFieldOrigins();
  fieldOrigins.link = "confirmed";
  if (fields.company) {
    fieldOrigins.company = "derived";
  }
  if (fields.roleTitle) {
    fieldOrigins.roleTitle = "derived";
  }

  return {
    fields,
    fieldOrigins,
    candidateValues: {
      company: companyCandidate ? [companyCandidate] : [],
      roleTitle: probableRole ? [capitalizeWords(probableRole)] : []
    }
  };
}

function toDraft(result: ExtractionResult): JobDraft {
  return {
    roleTitle: result.fields.roleTitle ?? "",
    company: result.fields.company ?? "",
    location: result.fields.location ?? "",
    link: result.fields.link ?? result.normalizedUrl,
    jobDescription: result.fields.jobDescription ?? "",
    sourceType: result.sourceType,
    sourceConfidence: result.sourceConfidence,
    extractionStatus: result.extractionStatus,
    fieldOrigins: result.fieldOrigins,
    candidateValues: result.candidateValues,
    issues: result.issues,
    unsupportedReason: result.unsupportedReason
  };
}

export function buildFallbackExtraction(rawUrl: string): ExtractionResult {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return {
      normalizedUrl: rawUrl,
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review",
      supported: false,
      unsupportedReason: "The pasted value is not a valid URL.",
      fields: { link: rawUrl },
      fieldOrigins: { link: "derived" },
      candidateValues: {},
      issues: [
        {
          field: "link",
          type: "suspicious",
          message: "Link is not a valid URL."
        }
      ],
      notes: ["Manual review is required before this record can be saved."]
    };
  }

  const source = detectSource(normalized);
  const derived = deriveFromUrl(normalized);

  const result: ExtractionResult = {
    normalizedUrl: normalized,
    sourceType: source.sourceType,
    sourceConfidence: source.sourceConfidence,
    extractionStatus: "needs_review",
    supported: source.sourceType !== "linkedin",
    unsupportedReason:
      source.sourceType === "linkedin"
        ? "LinkedIn pages are restricted, so this link needs manual review."
        : undefined,
    fields: derived.fields,
    fieldOrigins: derived.fieldOrigins,
    candidateValues: derived.candidateValues,
    issues: [],
    notes: ["Only low-confidence URL hints were available."]
  };

  return withValidation(result);
}

function withValidation(result: ExtractionResult) {
  const draft = toDraft(result);
  const issues = validateJobDraft(draft);
  return {
    ...result,
    issues,
    extractionStatus: issues.length > 0 ? "needs_review" : "confirmed"
  } satisfies ExtractionResult;
}

export async function extractJob(rawUrl: string) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return buildFallbackExtraction(rawUrl);
  }

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: normalized })
    });

    if (!response.ok) {
      return buildFallbackExtraction(normalized);
    }

    const payload = (await response.json()) as ExtractionResult;
    return withValidation({
      ...payload,
      normalizedUrl: payload.normalizedUrl || normalized,
      fields: {
        ...payload.fields,
        link: normalized
      }
    });
  } catch {
    return buildFallbackExtraction(normalized);
  }
}

export function mergeDraftField(
  draft: JobDraft,
  field: JobField,
  value: string
): JobDraft {
  const nextCandidateValues = {
    ...draft.candidateValues,
    [field]: uniqueValues([...(draft.candidateValues[field] ?? []), value])
  };

  const nextDraft: JobDraft = {
    ...draft,
    [field]: value,
    fieldOrigins: {
      ...draft.fieldOrigins,
      [field]: value ? "manual" : "missing"
    },
    candidateValues: nextCandidateValues
  };

  return {
    ...nextDraft,
    issues: validateJobDraft(nextDraft)
  };
}

export function draftFromExtraction(result: ExtractionResult) {
  return {
    ...toDraft(result),
    issues: validateJobDraft(toDraft(result))
  };
}
