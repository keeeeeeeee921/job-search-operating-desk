import { describe, expect, it } from "vitest";
import { formatDate, getEasternDateKey, normalizeLocationForStorage } from "@/lib/utils";

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

describe("formatDate", () => {
  it("renders the Eastern-time calendar date regardless of the process time zone", () => {
    // 02:00 UTC on Apr 6 is still Apr 5 in New York. Vercel renders in UTC
    // and the browser in the viewer's zone; both must agree.
    expect(formatDate("2026-04-06T02:00:00.000Z")).toBe("Apr 5, 2026");
    expect(formatDate("2026-04-06T12:00:00.000Z")).toBe("Apr 6, 2026");
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
