import { describe, expect, it } from "vitest";
import { detectSource } from "@/lib/sourceDetection";

describe("detectSource", () => {
  it("identifies known providers", () => {
    expect(detectSource("https://www.linkedin.com/jobs/view/123").sourceType).toBe(
      "linkedin"
    );
    expect(
      detectSource("https://boards.greenhouse.io/company/jobs/123").sourceType
    ).toBe("greenhouse");
    expect(detectSource("https://jobs.lever.co/company/123").sourceType).toBe(
      "lever"
    );
    expect(
      detectSource("https://wd1.myworkdayjobs.com/en-US/careers/job/123").sourceType
    ).toBe("workday");
  });

  it("falls back to company or unknown", () => {
    expect(detectSource("https://careers.example.com/jobs/data-analyst").sourceType).toBe(
      "company"
    );
    expect(detectSource("not-a-url").sourceType).toBe("unknown");
  });
});
