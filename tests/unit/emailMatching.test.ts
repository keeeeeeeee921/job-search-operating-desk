import { describe, expect, it } from "vitest";
import { findEmailMatches } from "@/lib/emailMatching";
import { seedActiveJobs } from "@/lib/seed";
import type { JobRecord } from "@/lib/types";

describe("findEmailMatches", () => {
  it("returns likely Active matches for a rejection email", () => {
    const matches = findEmailMatches(
      "Thank you for applying to the Logistics Planning Engineer role at Tesla Shanghai. We will not move forward.",
      seedActiveJobs
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.record.company).toBe("Tesla");
  });

  it("does not bias score by recency when semantic overlap is identical", () => {
    const template = seedActiveJobs[0] as JobRecord;
    const older: JobRecord = {
      ...template,
      id: "older",
      roleTitle: "Senior Associate, Data Scientist - Applied AI",
      company: "Capital One",
      location: "McLean, Virginia, United States",
      jobDescription:
        "Applied AI role focused on credit modeling, experimentation, and production analytics.",
      timestamp: "2025-11-19T04:48:23.217Z"
    };
    const recent: JobRecord = {
      ...older,
      id: "recent",
      timestamp: "2026-03-16T04:48:23.217Z"
    };

    const matches = findEmailMatches(
      "Thank you for taking the time to apply to the Senior Associate, Data Scientist - Applied AI role at Capital One. We have decided to move forward with other candidates.",
      [older, recent]
    );

    const olderMatch = matches.find((item) => item.record.id === "older");
    const recentMatch = matches.find((item) => item.record.id === "recent");

    expect(olderMatch).toBeDefined();
    expect(recentMatch).toBeDefined();
    expect(olderMatch?.score).toBe(recentMatch?.score);
    expect(
      matches.flatMap((item) => item.reasons).includes("Saved recently")
    ).toBe(false);
  });
});
