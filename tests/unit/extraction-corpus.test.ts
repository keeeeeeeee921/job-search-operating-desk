import { describe, expect, it } from "vitest";
import corpus from "@/tests/fixtures/extraction-corpus.json";
import { extractJobFromText } from "@/lib/text-extractor";

describe("extraction corpus regression", () => {
  for (const sample of corpus) {
    it(`extracts expected fields for ${sample.id}`, () => {
      const result = extractJobFromText(sample.input);

      expect(result.fields.roleTitle).toBe(sample.expected.roleTitle);
      expect(result.fields.company).toBe(sample.expected.company);
      expect(result.fields.location).toBe(sample.expected.location);
      expect(result.fields.jobDescription).toContain(
        sample.expected.jobDescriptionExcerpt
      );
    });
  }
});
