import { validateJobDraft } from "@/lib/recordValidation";
import type {
  ExtractionResult,
  FieldOrigin,
  JobDraft,
  JobField,
  SourceConfidence,
  SourceType
} from "@/lib/types";
import { uniqueValues } from "@/lib/utils";

const sectionHeaders = new Set([
  "about the job",
  "description",
  "responsibilities",
  "responsibilities:",
  "required skills",
  "required skills:",
  "preferred qualifications",
  "preferred qualifications:",
  "minimum education",
  "minimum experience",
  "knowledge, skills and abilities",
  "essential functions",
  "additional details",
  "pay",
  "know your rights",
  "pay transparency"
]);

const metadataLabels = new Set([
  "company",
  "category",
  "employment type",
  "worker sub-type",
  "worker sub type",
  "remote",
  "location",
  "req id"
]);

const linkedinNoisePatterns = [
  /^show more options$/i,
  /^show match details$/i,
  /^tailor my resume$/i,
  /^create cover letter$/i,
  /^help me stand out$/i,
  /^people you can reach out to$/i,
  /^promoted by /i,
  /^save /i,
  /^message$/i,
  /^share$/i,
  /^simplify$/i,
  /^v\d+$/i,
  /^\d+%$/,
  /^resume match$/i,
  /^easy apply$/i,
  /^show more$/i,
  /^show less$/i,
  /^starting at /i,
  /^matches your job preferences/i,
  /^no response insights/i,
  /^over \d+ applicants$/i,
  /^.+ logo$/i,
  /^.+ profile photo$/i,
  /^.+ is verified$/i,
  /^school alum /i
];

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isNoiseLine(line: string) {
  const trimmed = cleanLine(line);

  if (!trimmed) {
    return true;
  }

  if (linkedinNoisePatterns.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  return false;
}

function normalizeLines(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => cleanLine(line))
    .filter((line) => !isNoiseLine(line));
}

function emptyFieldOrigins(): Partial<Record<JobField, FieldOrigin>> {
  return {
    roleTitle: "missing",
    company: "missing",
    location: "missing",
    link: "missing",
    jobDescription: "missing"
  };
}

function detectTextSource(rawText: string): {
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
} {
  const joined = rawText.toLowerCase();

  if (
    joined.includes("easy apply") ||
    joined.includes("resume match") ||
    joined.includes("promoted by hirer") ||
    joined.includes("linkedin")
  ) {
    return {
      sourceType: "linkedin",
      sourceConfidence: "low"
    };
  }

  return {
    sourceType: "unknown",
    sourceConfidence: "unknown"
  };
}

function isSectionHeader(line: string) {
  return sectionHeaders.has(line.toLowerCase());
}

function isMetadataLine(line: string) {
  const lower = line.toLowerCase();

  if (isSectionHeader(line)) {
    return true;
  }

  if (
    lower === "student programs" ||
    lower === "full time" ||
    lower === "contract" ||
    lower === "remote" ||
    lower === "on-site" ||
    lower === "hybrid" ||
    lower === "yes"
  ) {
    return true;
  }

  return Array.from(metadataLabels).some((label) =>
    lower.startsWith(`${label}:`)
  );
}

function extractLabeledValue(lines: string[], label: string) {
  const lowerLabel = label.toLowerCase();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();

    if (!lower.startsWith(`${lowerLabel}:`)) {
      continue;
    }

    const inlineValue = cleanLine(line.slice(label.length + 1));

    if (inlineValue) {
      return {
        value: inlineValue,
        startIndex: index
      };
    }

    const next = lines[index + 1] ?? "";
    if (next && !isMetadataLine(next)) {
      return {
        value: next,
        startIndex: index + 1
      };
    }
  }

  return null;
}

function extractSummaryLine(lines: string[]) {
  return (
    lines.find((line) => {
      const normalized = line.toLowerCase();

      if (
        normalized.includes("applicants") ||
        normalized.includes("hours ago") ||
        normalized.includes("minutes ago") ||
        normalized.includes("days ago")
      ) {
        return false;
      }

      return /^[^·]+ · [^(]+(?: \((?:On-site|Remote|Hybrid)\))?$/i.test(line);
    }) ?? ""
  );
}

function parseCompanyAndLocationFromSummary(summaryLine: string) {
  if (!summaryLine) {
    return {
      company: "",
      locationCandidates: []
    };
  }

  const [companyPart, locationPart] = summaryLine.split(" · ");
  const company = cleanLine(companyPart ?? "");
  const primaryLocation = cleanLine(
    (locationPart ?? "").replace(/\((?:On-site|Remote|Hybrid)\)/gi, "")
  );
  const workplaceTypeMatch = summaryLine.match(/\((On-site|Remote|Hybrid)\)/i);
  const workplaceType = workplaceTypeMatch?.[1] ?? "";

  return {
    company,
    locationCandidates: uniqueValues(
      [primaryLocation, workplaceType].filter(Boolean)
    )
  };
}

function looksLikeRoleTitle(line: string) {
  if (line.length < 4 || line.length > 120) {
    return false;
  }

  if (isMetadataLine(line)) {
    return false;
  }

  if (/^Req ID\b/i.test(line)) {
    return false;
  }

  if (
    /^(Agility Partners|Save|Easy Apply|Contract|On-site|Remote|Hybrid)$/i.test(
      line
    )
  ) {
    return false;
  }

  if (/[·]/.test(line)) {
    return false;
  }

  if (/applicants/i.test(line)) {
    return false;
  }

  return /(engineer|analyst|scientist|manager|intern|developer|specialist|consultant|associate|administrator|architect|lead|director)/i.test(
    line
  );
}

function extractRoleTitle(lines: string[]) {
  for (const line of lines.slice(0, 14)) {
    if (looksLikeRoleTitle(line)) {
      return line;
    }
  }

  return "";
}

function extractLocationCandidates(lines: string[]) {
  const locationIndex = lines.findIndex((line) =>
    line.toLowerCase().startsWith("location:")
  );

  if (locationIndex >= 0) {
    const line = lines[locationIndex];
    const inlineValue = cleanLine(line.slice("Location:".length));
    const candidates = inlineValue ? [inlineValue] : [];

    for (let nextIndex = locationIndex + 1; nextIndex < lines.length; nextIndex += 1) {
      const next = lines[nextIndex];
      const nextLower = next.toLowerCase();

      if (
        isSectionHeader(next) ||
        (next.includes(":") && metadataLabels.has(next.split(":")[0].toLowerCase()))
      ) {
        break;
      }

      if (
        nextLower === "yes" ||
        nextLower === "no" ||
        /^req id\b/i.test(next)
      ) {
        break;
      }

      candidates.push(next);
    }

    return uniqueValues(
      candidates.map((candidate) =>
        candidate.includes("United States")
          ? candidate.replace(", United States", ", US")
          : candidate
      )
    );
  }

  const summary = extractSummaryLine(lines);
  return parseCompanyAndLocationFromSummary(summary).locationCandidates;
}

function extractDescription(lines: string[]) {
  const aboutIndex = lines.findIndex(
    (line) =>
      line.toLowerCase() === "about the job" ||
      line.toLowerCase() === "description"
  );

  if (aboutIndex === -1) {
    return "";
  }

  const collected: string[] = [];

  for (let index = aboutIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (
      /^people you can reach out to$/i.test(line) ||
      /^about the company$/i.test(line)
    ) {
      break;
    }

    collected.push(line);
  }

  return collected.join("\n\n").trim();
}

function buildDraft(result: ExtractionResult): JobDraft {
  return {
    inputMode: "text",
    roleTitle: result.fields.roleTitle ?? "",
    company: result.fields.company ?? "",
    location: result.fields.location ?? "",
    link: "",
    jobDescription: result.fields.jobDescription ?? "",
    sourceType: result.sourceType,
    sourceConfidence: result.sourceConfidence,
    extractionStatus: result.extractionStatus,
    fieldOrigins: result.fieldOrigins,
    candidateValues: result.candidateValues,
    issues: []
  };
}

export function extractJobFromText(rawText: string): ExtractionResult {
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return {
      normalizedUrl: "",
      inputMode: "text",
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review",
      supported: true,
      fields: {
        link: ""
      },
      fieldOrigins: {
        link: "missing"
      },
      candidateValues: {},
      issues: [
        {
          field: "jobDescription",
          type: "missing",
          message: "Paste the job text before saving."
        }
      ],
      notes: ["Manual text input was empty."]
    };
  }

  const lines = normalizeLines(trimmedText);
  const source = detectTextSource(trimmedText);
  const roleTitle = extractRoleTitle(lines);
  const companyResult = extractLabeledValue(lines, "Company");
  const summaryLine = extractSummaryLine(lines);
  const summary = parseCompanyAndLocationFromSummary(summaryLine);
  const company = companyResult?.value ?? summary.company;
  const locationCandidates = extractLocationCandidates(lines);
  const description = extractDescription(lines);
  const fieldOrigins = emptyFieldOrigins();

  if (roleTitle) {
    fieldOrigins.roleTitle = "confirmed";
  }
  if (company) {
    fieldOrigins.company = "confirmed";
  }
  if (locationCandidates.length) {
    fieldOrigins.location = "confirmed";
  }
  if (description) {
    fieldOrigins.jobDescription = "confirmed";
  }

  const result: ExtractionResult = {
    normalizedUrl: "",
    inputMode: "text",
    sourceType: source.sourceType,
    sourceConfidence: source.sourceConfidence,
    extractionStatus: "needs_review",
    supported: true,
    fields: {
      roleTitle,
      company,
      location: locationCandidates[0] ?? "",
      link: "",
      jobDescription: description
    },
    fieldOrigins,
    candidateValues: {
      roleTitle: roleTitle ? [roleTitle] : [],
      company: company ? [company] : [],
      location: locationCandidates,
      jobDescription: description ? [description] : []
    },
    issues: [],
    notes: [
      source.sourceType === "linkedin"
        ? "LinkedIn pasted text was cleaned before parsing."
        : "Job text was parsed locally and may still need review."
    ]
  };

  const draft = buildDraft(result);
  const issues = validateJobDraft(draft);

  return {
    ...result,
    issues,
    extractionStatus: issues.length > 0 ? "needs_review" : "confirmed"
  };
}
