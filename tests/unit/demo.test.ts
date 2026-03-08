import { afterEach, describe, expect, it } from "vitest";
import { getDemoBannerMessage, isPublicDemo } from "@/lib/demo";

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

  it("uses daily-reset copy for the public demo banner", () => {
    expect(getDemoBannerMessage()).toContain("resets daily");
  });
});
