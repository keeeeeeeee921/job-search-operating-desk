import { describe, expect, it } from "vitest";
import { extractJobFromText } from "@/lib/text-extractor";

describe("extractJobFromText", () => {
  it("extracts role, company, location, and description from pasted job text", () => {
    const result = extractJobFromText(`
Req ID: P25-321635-2
Data Science Intern (Summer 2026)
Student Programs
Company: Federal Express Corporation
Location:
Remote
3680 Hacks Cross Road, Memphis, TN 38125-8800, United States
Description
As a FedEx Intern, you will be working on projects gaining valuable, real-world experience.
Preferred Qualifications
Python
    `);

    expect(result.inputMode).toBe("text");
    expect(result.fields.roleTitle).toBe("Data Science Intern (Summer 2026)");
    expect(result.fields.company).toBe("Federal Express Corporation");
    expect(result.fields.location).toBe("Remote");
    expect(result.fields.link).toBe("");
    expect(result.fields.jobDescription).toContain("As a FedEx Intern");
    expect(result.issues.some((issue) => issue.field === "link")).toBe(false);
  });
});
