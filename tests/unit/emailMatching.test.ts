import { describe, expect, it } from "vitest";
import { findEmailMatches } from "@/lib/emailMatching";
import { seedActiveJobs } from "@/lib/seed";

describe("findEmailMatches", () => {
  it("returns likely Active matches for a rejection email", () => {
    const matches = findEmailMatches(
      "Thank you for applying to the Logistics Planning Engineer role at Tesla Shanghai. We will not move forward.",
      seedActiveJobs
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.record.company).toBe("Tesla");
  });
});
