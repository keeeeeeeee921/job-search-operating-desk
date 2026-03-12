import { describe, expect, it } from "vitest";
import { getEasternDateKey, normalizeLocationForStorage } from "@/lib/utils";

describe("getEasternDateKey", () => {
  it("uses America/New_York midnight boundaries", () => {
    expect(getEasternDateKey(new Date("2026-03-07T04:59:00.000Z"))).toBe(
      "2026-03-06"
    );
    expect(getEasternDateKey(new Date("2026-03-07T05:01:00.000Z"))).toBe(
      "2026-03-07"
    );
  });
});

describe("normalizeLocationForStorage", () => {
  it("normalizes US city and state abbreviations to city, state, country", () => {
    expect(normalizeLocationForStorage("Cincinnati, OH")).toBe(
      "Cincinnati, Ohio, United States"
    );
  });

  it("normalizes remote US forms to United States (Remote)", () => {
    expect(normalizeLocationForStorage("Remote: USA")).toBe(
      "United States (Remote)"
    );
    expect(normalizeLocationForStorage("United States (Remote)")).toBe(
      "United States (Remote)"
    );
  });

  it("normalizes Canada province abbreviations", () => {
    expect(normalizeLocationForStorage("Toronto, ON")).toBe(
      "Toronto, Ontario, Canada"
    );
  });

  it("leaves non-empty unknown strings unchanged", () => {
    expect(normalizeLocationForStorage("Greater Toronto Area")).toBe(
      "Greater Toronto Area"
    );
  });
});
