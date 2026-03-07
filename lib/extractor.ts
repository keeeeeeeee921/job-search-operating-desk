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

function cleanUrlChunk(value: string) {
  return decodeURIComponent(value)
    .replace(/[+_]/g, " ")
    .replace(/-/g, " ")
    .replace(/\b(job|jobs|career|careers|apply|application|details|detail|listing|view)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function providerHostCompany(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (normalized.endsWith(".myworkdayjobs.com")) {
    return capitalizeWords(normalized.split(".")[0] ?? "");
  }

  return "";
}

function deriveLinkedInHints(parsed: URL) {
  const segments = parsed.pathname.split("/").filter(Boolean);
  const viewIndex = segments.findIndex((segment) => segment.toLowerCase() === "view");
  const slug = viewIndex >= 0 ? segments[viewIndex + 1] ?? "" : "";
  const easyApply =
    parsed.pathname.toLowerCase().includes("easy-apply") ||
    parsed.searchParams.has("currentJobId");

  if (!slug || /^\d+$/.test(slug)) {
    return {
      fields: {},
      fieldOrigins: emptyFieldOrigins(),
      candidateValues: {},
      unsupportedReason: easyApply
        ? "LinkedIn Easy Apply links do not expose enough public detail here. Paste the posting URL with the title slug if possible, or fill the missing fields manually."
        : slug && /^\d+$/.test(slug)
          ? "This LinkedIn job link only exposes a numeric job ID, not a readable role/company slug. Manual review is required."
          : "LinkedIn pages are restricted, so this link needs manual review.",
      notes: [
        easyApply
          ? "LinkedIn Easy Apply links are restricted and often only expose a job ID."
          : slug && /^\d+$/.test(slug)
            ? "This LinkedIn view link contains only a numeric job ID."
            : "LinkedIn does not expose enough public metadata for reliable extraction."
      ]
    };
  }

  const withoutId = slug.replace(/-\d{6,}$/, "");
  const lower = withoutId.toLowerCase();
  const atIndex = lower.lastIndexOf("-at-");
  const roleChunk = atIndex >= 0 ? withoutId.slice(0, atIndex) : withoutId;
  const companyChunk = atIndex >= 0 ? withoutId.slice(atIndex + 4) : "";
  const roleTitle = capitalizeWords(cleanUrlChunk(roleChunk));
  const company = capitalizeWords(cleanUrlChunk(companyChunk));

  const fieldOrigins = emptyFieldOrigins();
  const fields: PartialFieldMap = {
    link: parsed.toString(),
    roleTitle,
    company
  };
  fieldOrigins.link = "confirmed";
  if (roleTitle) {
    fieldOrigins.roleTitle = "derived";
  }
  if (company) {
    fieldOrigins.company = "derived";
  }

  return {
    fields,
    fieldOrigins,
    candidateValues: {
      roleTitle: roleTitle ? [roleTitle] : [],
      company: company ? [company] : []
    },
    unsupportedReason: easyApply
      ? "LinkedIn Easy Apply links are restricted. The URL slug provided a few hints, but manual review is still required."
      : "LinkedIn pages are restricted, so this link still needs manual review.",
    notes: [
      easyApply
        ? "Only LinkedIn URL hints were available from an Easy Apply link."
        : "Only LinkedIn URL hints were available."
    ]
  };
}

function deriveProviderHints(
  normalizedUrl: string,
  sourceType: ReturnType<typeof detectSource>["sourceType"]
): {
  fields: PartialFieldMap;
  fieldOrigins: Partial<Record<JobField, FieldOrigin>>;
  candidateValues: Partial<Record<JobField, string[]>>;
  unsupportedReason?: string;
  notes?: string[];
} {
  const parsed = new URL(normalizedUrl);

  if (sourceType === "linkedin") {
    return deriveLinkedInHints(parsed);
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1) ?? "";
  const previousSegment = segments.at(-2) ?? "";
  const fieldOrigins = emptyFieldOrigins();
  const fields: PartialFieldMap = {
    link: normalizedUrl
  };
  fieldOrigins.link = "confirmed";

  let roleTitle = "";
  let company = "";

  if (sourceType === "greenhouse") {
    company = capitalizeWords(cleanUrlChunk(segments[0] ?? ""));
    roleTitle = capitalizeWords(cleanUrlChunk(/^\d+$/.test(lastSegment) ? previousSegment : lastSegment));
  } else if (sourceType === "lever") {
    company = capitalizeWords(cleanUrlChunk(segments[0] ?? ""));
    roleTitle = capitalizeWords(cleanUrlChunk(lastSegment));
  } else if (sourceType === "workday") {
    company = providerHostCompany(parsed.hostname);
    roleTitle = capitalizeWords(
      cleanUrlChunk(lastSegment.replace(/_[A-Z0-9-]+$/i, ""))
    );
  } else {
    const slug = segments.slice(-2).join(" ");
    roleTitle = capitalizeWords(cleanUrlChunk(slug));
    if (sourceType === "company" || sourceType === "unknown") {
      company = hostToCompany(parsed.hostname);
    }
  }

  if (roleTitle) {
    fields.roleTitle = roleTitle;
    fieldOrigins.roleTitle = "derived";
  }

  if (company) {
    fields.company = company;
    fieldOrigins.company = "derived";
  }

  return {
    fields,
    fieldOrigins,
    candidateValues: {
      roleTitle: roleTitle ? [roleTitle] : [],
      company: company ? [company] : []
    }
  };
}

function deriveFromUrl(normalizedUrl: string): {
  fields: PartialFieldMap;
  fieldOrigins: Partial<Record<JobField, FieldOrigin>>;
  candidateValues: Partial<Record<JobField, string[]>>;
  unsupportedReason?: string;
  notes?: string[];
} {
  const source = detectSource(normalizedUrl);
  const derived = deriveProviderHints(normalizedUrl, source.sourceType);

  return {
    fields: {
      location: "",
      jobDescription: "",
      ...derived.fields
    },
    fieldOrigins: derived.fieldOrigins,
    candidateValues: derived.candidateValues,
    unsupportedReason: derived.unsupportedReason,
    notes: derived.notes
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
      derived.unsupportedReason ??
      (source.sourceType === "linkedin"
        ? "LinkedIn pages are restricted, so this link needs manual review."
        : undefined),
    fields: derived.fields,
    fieldOrigins: derived.fieldOrigins,
    candidateValues: derived.candidateValues,
    issues: [],
    notes: derived.notes ?? ["Only low-confidence URL hints were available."]
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
