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

  it("removes repeated metadata prefixes from pasted descriptions", () => {
    const result = extractJobFromText(`
Junior SQL Analyst
Paradigm Technology · 100% REMOTE (Remote)
About the job
Position: Junior SQL Analyst Location: 100% REMOTE Summary: Seeking a Junior SQL Analyst to write, optimize, and maintain SQL queries to support reporting, analytics, and data validation.
    `);

    expect(result.fields.jobDescription).toBe(
      "Seeking a Junior SQL Analyst to write, optimize, and maintain SQL queries to support reporting, analytics, and data validation."
    );
  });

  it("normalizes Remote: USA location blocks from Torre-style pasted text", () => {
    const result = extractJobFromText(`
Emma of Torre.ai
Entry-Level Implementation Analyst | Fintech | Remote US
Emma of Torre.ai · United States (Remote)
About the job
You'll drive financial automation and digital transformation for global clients, accelerating your fintech career.
Location:
Remote: USA
Mission of Pi3AI:
"To empower businesses with reliable, cutting-edge technology."
    `);

    expect(result.fields.roleTitle).toBe(
      "Entry-Level Implementation Analyst | Fintech | Remote US"
    );
    expect(result.fields.company).toBe("Emma of Torre.ai");
    expect(result.fields.location).toBe("United States (Remote)");
    expect(result.issues.some((issue) => issue.field === "location")).toBe(false);
  });

  it("falls back to a standalone company line when the summary line is missing", () => {
    const result = extractJobFromText(`
Emma of Torre.ai
Entry-Level Implementation Analyst | Fintech | Remote US
United States · 16 minutes ago · 5 people clicked apply
About the job
You'll drive financial automation and digital transformation for global clients.
Location:
Remote: USA
    `);

    expect(result.fields.company).toBe("Emma of Torre.ai");
    expect(result.issues.some((issue) => issue.field === "company")).toBe(false);
  });

  it("captures a standalone company line placed between role and location blocks", () => {
    const result = extractJobFromText(`
Entry-Level Implementation Analyst | Fintech | Remote US
Emma of Torre.ai
Location:
United States (Remote)
About the job
You'll drive financial automation and digital transformation for global clients.
    `);

    expect(result.fields.company).toBe("Emma of Torre.ai");
    expect(result.fields.location).toBe("United States (Remote)");
  });

  it("extracts location from LinkedIn posting meta lines when Location label is absent", () => {
    const result = extractJobFromText(`
Entry-Level Implementation Analyst | Fintech | Remote US
Emma of Torre.ai
United States · 16 minutes ago · 5 people clicked apply
About the job
You'll drive financial automation and digital transformation for global clients.
    `);

    expect(result.fields.location).toBe("United States");
    expect(result.issues.some((issue) => issue.field === "location")).toBe(false);
  });

  it("extracts city/state location from posting-age lines", () => {
    const result = extractJobFromText(`
Junior Data Engineer
Agility Partners
Cincinnati, OH · 9 hours ago · Over 100 applicants
About the job
Run monthly data product refreshes and support SQL workflows.
    `);

    expect(result.fields.location).toBe("Cincinnati, OH");
    expect(result.issues.some((issue) => issue.field === "location")).toBe(false);
  });

  it("prefers labeled remote location over street-address lines", () => {
    const result = extractJobFromText(`
Data Science Intern (Summer 2026)
Company: Federal Express Corporation
Location:
Remote
3680 Hacks Cross Road, Memphis, TN 38125-8800, United States
Description
As a FedEx Intern, you will be working on projects gaining valuable, real-world experience.
    `);

    expect(result.fields.location).toBe("Remote");
    expect(result.candidateValues.location?.[0]).toBe("Remote");
  });

  it("keeps location missing when only noisy Easy Apply lines are present", () => {
    const result = extractJobFromText(`
Entry-Level Implementation Analyst | Fintech | Remote US
Emma of Torre.ai
Promoted by hirer · No response insights available yet
Over 100 applicants
Easy Apply
Save
About the job
You'll drive financial automation and digital transformation for global clients.
    `);

    expect(result.fields.location).toBe("");
    expect(result.issues.some((issue) => issue.field === "location")).toBe(true);
  });
});
