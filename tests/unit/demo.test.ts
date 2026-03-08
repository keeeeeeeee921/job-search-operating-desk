import { afterEach, describe, expect, it } from "vitest";
import { isPublicDemo, shouldRunDemoResetNow } from "@/lib/demo";

const originalPublicDemo = process.env.JOB_DESK_PUBLIC_DEMO;

describe("demo helpers", () => {
  afterEach(() => {
    if (originalPublicDemo === undefined) {
      delete process.env.JOB_DESK_PUBLIC_DEMO;
      return;
    }

    process.env.JOB_DESK_PUBLIC_DEMO = originalPublicDemo;
  });

  it("detects public demo mode from the environment flag", () => {
    process.env.JOB_DESK_PUBLIC_DEMO = "true";
    expect(isPublicDemo()).toBe(true);

    process.env.JOB_DESK_PUBLIC_DEMO = "false";
    expect(isPublicDemo()).toBe(false);
  });

  it("runs the reset only during the 3 AM Eastern hour", () => {
    expect(shouldRunDemoResetNow(new Date("2026-03-07T08:15:00.000Z"))).toBe(true);
    expect(shouldRunDemoResetNow(new Date("2026-03-07T07:15:00.000Z"))).toBe(false);
  });
});
