import { describe, expect, it } from "vitest";
import { findDuplicateCandidates } from "@/lib/duplicateDetection";
import { seedActiveJobs } from "@/lib/seed";
import type { JobDraft } from "@/lib/types";

describe("findDuplicateCandidates", () => {
  it("finds likely duplicates from company, role, and description overlap", () => {
    const draft: JobDraft = {
      inputMode: "link",
      roleTitle: "Associate Business Analyst - Entry Level",
      company: "IBM Canada",
      location: "Toronto, ON",
      link: "https://example.com/jobs/ibm-canada-associate-business-analyst",
      jobDescription:
        "Support reporting, clarify requirements, and translate business questions into datasets and dashboards.",
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

    const results = findDuplicateCandidates(draft, seedActiveJobs);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.record.company).toBe("IBM Canada");
  });
});
