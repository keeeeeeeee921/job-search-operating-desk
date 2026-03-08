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
    expect(result.fields.location).toBe("Cincinnati, Ohio, United States of America");
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
    expect(result.fields.location).toBe("Tempe, Arizona, United States of America");
    expect(result.fields.jobDescription).not.toContain("&lt;");
    expect(result.fields.jobDescription).toContain("Position Overview:");
    expect((result.fields.jobDescription ?? "").length).toBeGreaterThan(700);
  });
});
