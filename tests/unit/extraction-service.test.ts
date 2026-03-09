import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractCandidatesFromHtml } from "@/lib/server/extraction-service";

function readFixture(name: string) {
  return readFileSync(
    `${process.cwd()}/tests/fixtures/company-pages/${name}`,
    "utf8"
  );
}

describe("server extraction service", () => {
  it("decodes and preserves the full Cincinnati Children's job description", () => {
    const result = extractCandidatesFromHtml(
      readFixture("cincinnatichildrens.html"),
      "https://jobs.cincinnatichildrens.org/us/en/job/CINCCHUSJR218015EXTERNALENUS/Business-Intelligence-Analyst"
    );

    expect(result.fields.company).toBe("Cincinnati Children's");
    expect(result.fields.location).toBe("Cincinnati, Ohio, United States");
    expect(result.fields.jobDescription).not.toContain("&lt;");
    expect(result.fields.jobDescription).toContain("JOB RESPONSIBILITIES");
    expect((result.fields.jobDescription ?? "").length).toBeGreaterThan(500);
  });

  it("keeps MSG location location-shaped and prefers the full article body", () => {
    const result = extractCandidatesFromHtml(
      readFixture("msgentertainment.html"),
      "https://www.msgentertainment.com/jobs/analyst-business-intelligence-new-york-city-ny/?gh_jid=5069013007&gh_src=9a74a7c57us"
    );

    expect(result.fields.roleTitle).toBe("Analyst Business Intelligence");
    expect(result.fields.company).toContain("Madison Square Garden Entertainment");
    expect(result.fields.location).toBe("New York City, NY");
    expect(result.fields.location).not.toContain("Join the Team");
    expect(result.fields.jobDescription).toContain("Who are we hiring?");
    expect((result.fields.jobDescription ?? "").length).toBeGreaterThan(800);
  });

  it("decodes Dutch Bros job descriptions and keeps the extracted location short", () => {
    const result = extractCandidatesFromHtml(
      readFixture("dutchbros.html"),
      "https://careers.dutchbros.com/us/en/job/DUTDBCUSREQ18004EXTERNALENUS/Customer-Insights-Analyst?source=LinkedIn"
    );

    expect(result.fields.company).toBe("Dutch Bros Coffee");
    expect(result.fields.location).toBe("Tempe, Arizona, United States");
    expect(result.fields.jobDescription).not.toContain("&lt;");
    expect(result.fields.jobDescription).toContain("Position Overview:");
    expect((result.fields.jobDescription ?? "").length).toBeGreaterThan(700);
  });

  it("prefers Workday display values over internal company and location labels", () => {
    const result = extractCandidatesFromHtml(
      readFixture("cvs-workday.html"),
      "https://cvshealth.wd1.myworkdayjobs.com/en-US/CVS_Health_Careers/job/IL--Chicago/Analyst--Development-Program_R0834053?source=Linkedin"
    );

    expect(result.fields.roleTitle).toBe("Analyst, Development Program");
    expect(result.fields.company).toBe("Oak Street Health");
    expect(result.fields.company).not.toContain("LLC");
    expect(result.fields.location).toBe("United States (Remote)");
    expect(result.fields.location).not.toContain("Treehouse");
    expect(result.fields.jobDescription).toContain("Why Oak Street Health?");
    expect((result.fields.jobDescription ?? "").length).toBeGreaterThan(1500);
  });

  it("parses UKG inline job payloads before generic page scraping", () => {
    const result = extractCandidatesFromHtml(
      readFixture("inquirer-ukg.html"),
      "https://inquirer.rec.pro.ukg.net/PHI1500PHILI/JobBoard/7dc63c3a-f663-4d44-893e-7372f75ba534/OpportunityDetail?opportunityId=9fc9f887-78ed-4489-ab40-c0ee6fbc437f&source=LinkedIn"
    );

    expect(result.fields.roleTitle).toBe("Data Analyst");
    expect(result.fields.company).toBe("The Philadelphia Inquirer");
    expect(result.fields.location).toBe("Philadelphia, PA, United States");
    expect(result.fields.jobDescription).toContain(
      "The Philadelphia Inquirer is an exciting place to build a career in journalism and analytics."
    );
    expect(result.fields.jobDescription).not.toContain("$(function");
    expect(result.fields.jobDescription).not.toContain(
      "CandidateOpportunityDetail"
    );
    expect(result.fields.jobDescription).not.toContain("ko.applyBindings");
    expect((result.fields.jobDescription ?? "").length).toBeGreaterThan(1200);
    expect(result.extractionStatus).toBe("confirmed");
  });
});
