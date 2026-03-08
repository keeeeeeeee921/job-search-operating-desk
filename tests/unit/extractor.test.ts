import { describe, expect, it } from "vitest";
import { buildFallbackExtraction, mergeDraftField } from "@/lib/extractor";
import type { JobDraft } from "@/lib/types";

describe("buildFallbackExtraction", () => {
  it("derives role and company hints from LinkedIn job slugs", () => {
    const result = buildFallbackExtraction(
      "https://www.linkedin.com/jobs/view/data-science-intern-summer-2026-at-fedex-4256789012"
    );

    expect(result.sourceType).toBe("linkedin");
    expect(result.fields.roleTitle).toBe("Data Science Intern Summer 2026");
    expect(result.fields.company).toBe("FedEx");
    expect(result.candidateValues.roleTitle).toContain(
      "Data Science Intern Summer 2026"
    );
    expect(result.candidateValues.company).toContain("FedEx");
    expect(result.unsupportedReason).toContain("manual review");
  });

  it("shows a more specific message for LinkedIn Easy Apply links", () => {
    const result = buildFallbackExtraction(
      "https://www.linkedin.com/jobs/collections/easy-apply/?currentJobId=4256789012"
    );

    expect(result.sourceType).toBe("linkedin");
    expect(result.fields.roleTitle).toBeUndefined();
    expect(result.fields.company).toBeUndefined();
    expect(result.unsupportedReason).toContain("Easy Apply");
  });

  it("explains when a LinkedIn view link only has a numeric job id", () => {
    const result = buildFallbackExtraction(
      "https://www.linkedin.com/jobs/view/4376823404/?alternateChannel=search&trk=flagship3"
    );

    expect(result.normalizedUrl).toBe(
      "https://www.linkedin.com/jobs/view/4376823404/"
    );
    expect(result.unsupportedReason).toContain("numeric job ID");
  });

  it("normalizes lifeattiktok referral links and keeps TikTok as the company hint", () => {
    const result = buildFallbackExtraction(
      "https://lifeattiktok.com/referral/tiktok/campus/position/7611463038325803269/detail?token=abc123"
    );

    expect(result.normalizedUrl).toBe(
      "https://lifeattiktok.com/referral/tiktok/campus/position/7611463038325803269/detail"
    );
    expect(result.fields.company).toBe("TikTok");
  });

  it("does not append manual edits back into candidate values", () => {
    const draft: JobDraft = {
      inputMode: "text",
      roleTitle: "Analyst",
      company: "Acme",
      location: "Remote",
      link: "",
      jobDescription: "Original description",
      sourceType: "unknown",
      sourceConfidence: "low",
      extractionStatus: "needs_review",
      fieldOrigins: {
        roleTitle: "confirmed",
        company: "confirmed",
        location: "confirmed",
        link: "missing",
        jobDescription: "confirmed"
      },
      candidateValues: {
        jobDescription: ["Original description"]
      },
      issues: []
    };

    const next = mergeDraftField(
      draft,
      "jobDescription",
      "Edited description"
    );

    expect(next.jobDescription).toBe("Edited description");
    expect(next.fieldOrigins.jobDescription).toBe("manual");
    expect(next.candidateValues.jobDescription).toEqual(["Original description"]);
  });
});
