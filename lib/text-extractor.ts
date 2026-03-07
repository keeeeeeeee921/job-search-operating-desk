import { validateJobDraft } from "@/lib/recordValidation";
import type { ExtractionResult, FieldOrigin, JobField } from "@/lib/types";
import { uniqueValues } from "@/lib/utils";

const sectionHeaders = new Set([
  "description",
  "preferred qualifications",
  "minimum education",
  "minimum experience",
  "knowledge, skills and abilities",
  "essential functions",
  "additional details",
  "pay",
  "share job",
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

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLines(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => cleanLine(line))
    .filter(Boolean);
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
    lower === "remote" ||
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

    if (lower.startsWith(`${lowerLabel}:`)) {
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
  }

  return null;
}

function extractLocationCandidates(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.toLowerCase().startsWith("location:")) {
      continue;
    }

    const inlineValue = cleanLine(line.slice("Location:".length));
    const candidates = inlineValue ? [inlineValue] : [];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const next = lines[nextIndex];
      if (
        isSectionHeader(next) ||
        (next.includes(":") && metadataLabels.has(next.split(":")[0].toLowerCase()))
      ) {
        break;
      }

      candidates.push(next);
    }

    const normalized = uniqueValues(
      candidates.map((candidate) => {
        if (candidate.toLowerCase() === "yes") {
          return "";
        }

        if (candidate.includes("United States")) {
          return candidate
            .replace(", United States", ", US")
            .replace(/\s+/g, " ")
            .trim();
        }

        return candidate;
      })
    );

    return normalized;
  }

  return [];
}

function extractRoleTitle(lines: string[]) {
  for (const line of lines.slice(0, 8)) {
    if (line.length < 4 || line.length > 120) {
      continue;
    }

    if (isMetadataLine(line)) {
      continue;
    }

    if (/^Req ID\b/i.test(line)) {
      continue;
    }

    return line;
  }

  return "";
}

function extractDescription(lines: string[]) {
  const descriptionIndex = lines.findIndex(
    (line) => line.toLowerCase() === "description"
  );

  if (descriptionIndex === -1) {
    return "";
  }

  const collected: string[] = [];
  for (let index = descriptionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionHeader(line)) {
      break;
    }
    collected.push(line);
  }

  return collected.join("\n\n").trim();
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
  const companyResult = extractLabeledValue(lines, "Company");
  const locationCandidates = extractLocationCandidates(lines);
  const roleTitle = extractRoleTitle(lines);
  const description = extractDescription(lines);
  const fieldOrigins = emptyFieldOrigins();

  if (roleTitle) {
    fieldOrigins.roleTitle = "confirmed";
  }
  if (companyResult?.value) {
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
    sourceType: "unknown",
    sourceConfidence: "unknown",
    extractionStatus: "needs_review",
    supported: true,
    fields: {
      roleTitle,
      company: companyResult?.value ?? "",
      location: locationCandidates[0] ?? "",
      link: "",
      jobDescription: description
    },
    fieldOrigins,
    candidateValues: {
      roleTitle: roleTitle ? [roleTitle] : [],
      company: companyResult?.value ? [companyResult.value] : [],
      location: locationCandidates,
      jobDescription: description ? [description] : []
    },
    issues: [],
    notes: ["Job text was parsed locally and may still need review."]
  };

  const draft = {
    inputMode: "text" as const,
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

  const issues = validateJobDraft(draft);
  return {
    ...result,
    issues,
    extractionStatus: issues.length > 0 ? "needs_review" : "confirmed"
  };
}
