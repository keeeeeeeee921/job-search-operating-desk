import { describe, expect, it } from "vitest";
import { validateJobDraft } from "@/lib/recordValidation";
import type { JobDraft } from "@/lib/types";

const baseDraft: JobDraft = {
  roleTitle: "Data Analyst",
  company: "Aurora Labs",
  location: "Toronto, ON",
  link: "https://example.com/jobs/data-analyst",
  jobDescription: "Analyze growth funnels and support KPI reviews.",
  sourceType: "company",
  sourceConfidence: "low",
  extractionStatus: "needs_review",
  fieldOrigins: {
    roleTitle: "manual",
    company: "manual",
    location: "manual",
    link: "confirmed",
    jobDescription: "manual"
  },
  candidateValues: {},
  issues: []
};

describe("validateJobDraft", () => {
  it("returns no issues for a complete manual draft", () => {
    expect(validateJobDraft(baseDraft)).toEqual([]);
  });

  it("flags derived and missing fields", () => {
    const issues = validateJobDraft({
      ...baseDraft,
      roleTitle: "Job",
      location: "",
      fieldOrigins: {
        ...baseDraft.fieldOrigins,
        roleTitle: "derived",
        location: "missing"
      }
    });

    expect(issues.some((issue) => issue.field === "location")).toBe(true);
    expect(issues.some((issue) => issue.field === "roleTitle")).toBe(true);
  });
});
