import { describe, expect, it } from "vitest";
import { findDuplicateCandidates } from "@/lib/duplicateDetection";
import { seedActiveJobs } from "@/lib/seed";
import type { JobDraft } from "@/lib/types";

describe("findDuplicateCandidates", () => {
  it("finds likely duplicates from company, role, and description overlap", () => {
    const draft: JobDraft = {
      inputMode: "link",
      roleTitle: "Data Analyst",
      company: "TikTok",
      location: "San Jose, CA",
      link: "https://example.com/jobs/data-analyst",
      jobDescription:
        "Build dashboards, investigate funnel shifts, and partner with product managers on growth analytics.",
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
    expect(results[0]?.record.company).toBe("TikTok");
  });
});
