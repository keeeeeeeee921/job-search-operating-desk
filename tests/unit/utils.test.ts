import { describe, expect, it } from "vitest";
import { getEasternDateKey } from "@/lib/utils";

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
