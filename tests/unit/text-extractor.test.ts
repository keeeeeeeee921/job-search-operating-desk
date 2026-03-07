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

  it("cleans LinkedIn Easy Apply noise and extracts the real fields", () => {
    const result = extractJobFromText(`
Agility Partners logo
Agility Partners
Share
Show more options
Junior Data Engineer
Cincinnati, OH · 9 hours ago · Over 100 applicants
Promoted by hirer · No response insights available yet
Starting at $25/hr
On-site
Contract
Easy Apply
Save
Save Junior Data Engineer at Agility Partners
33%
Resume Match
Junior Data Engineer
Agility Partners · Cincinnati, OH (On-site)
Easy Apply
About the job
A Little About This Gig
We’re hiring two Junior Data Engineers to join an Insights squad focused on modernizing and transforming a core Householding (HH) data ecosystem.
Responsibilities:
Run monthly Householding data product refreshes end-to-end using established playbooks and tooling
The Ideal Candidate
Required Skills:
Strong SQL abilities, including comfort with complex queries
    `);

    expect(result.sourceType).toBe("linkedin");
    expect(result.fields.roleTitle).toBe("Junior Data Engineer");
    expect(result.fields.company).toBe("Agility Partners");
    expect(result.fields.location).toBe("Cincinnati, OH");
    expect(result.fields.jobDescription).toContain("A Little About This Gig");
    expect(result.fields.jobDescription).not.toContain("Resume Match");
    expect(result.fields.jobDescription).not.toContain("Save Junior Data Engineer");
  });
});
