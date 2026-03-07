import {
  requiredJobFields,
  type JobDraft,
  type JobField,
  type ValidationIssue
} from "@/lib/types";
import { normalizeUrl } from "@/lib/utils";

const weakRoleWords = new Set([
  "job",
  "jobs",
  "career",
  "careers",
  "apply",
  "apply now",
  "opening",
  "openings",
  "position"
]);

function isWeakRoleTitle(value: string) {
  const normalized = value.trim().toLowerCase();
  return !normalized || weakRoleWords.has(normalized);
}

export function validateJobDraft(draft: JobDraft) {
  const issues: ValidationIssue[] = [];

  requiredJobFields.forEach((field) => {
    const value = draft[field].trim();
    if (!value) {
      issues.push({
        field,
        type: "missing",
        message: `${labelForField(field)} is required before saving.`
      });
      return;
    }

    if (draft.fieldOrigins[field] === "derived") {
      issues.push({
        field,
        type: "suspicious",
        message: `${labelForField(field)} was inferred from the URL and should be reviewed.`
      });
    }
  });

  if (draft.roleTitle && isWeakRoleTitle(draft.roleTitle)) {
    issues.push({
      field: "roleTitle",
      type: "suspicious",
      message: "Role title looks too generic to trust without manual review."
    });
  }

  if (!normalizeUrl(draft.link)) {
    issues.push({
      field: "link",
      type: "suspicious",
      message: "Link is not a valid URL."
    });
  }

  return dedupeIssues(issues);
}

export function labelForField(field: JobField) {
  switch (field) {
    case "roleTitle":
      return "Role Title";
    case "company":
      return "Company";
    case "location":
      return "Location";
    case "link":
      return "Link";
    case "jobDescription":
      return "Job Description";
  }
}

function dedupeIssues(issues: ValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}:${issue.type}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
