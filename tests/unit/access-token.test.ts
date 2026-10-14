import { describe, expect, it } from "vitest";
import {
  evaluateAccess,
  safeEqual,
  sanitizeNextPath
} from "@/lib/access-token";

describe("evaluateAccess", () => {
  it("allows a matching token", () => {
    expect(
      evaluateAccess("secret-1", {
        JOB_DESK_ACCESS_TOKEN: "secret-1",
        NODE_ENV: "production"
      })
    ).toEqual({ allowed: true, reason: "token_match" });
  });

  it("rejects a wrong or missing cookie when a token is configured", () => {
    const env = { JOB_DESK_ACCESS_TOKEN: "secret-1", NODE_ENV: "development" };
    expect(evaluateAccess("secret-2", env)).toEqual({
      allowed: false,
      reason: "token_mismatch"
    });
    expect(evaluateAccess(undefined, env)).toEqual({
      allowed: false,
      reason: "token_mismatch"
    });
  });

  it("treats a blank token as not configured", () => {
    expect(
      evaluateAccess("anything", {
        JOB_DESK_ACCESS_TOKEN: "   ",
        NODE_ENV: "production"
      })
    ).toEqual({ allowed: false, reason: "token_not_configured" });
  });

  it("bypasses outside production when no token is configured", () => {
    expect(evaluateAccess(undefined, { NODE_ENV: "development" })).toEqual({
      allowed: true,
      reason: "development_bypass"
    });
    expect(evaluateAccess(undefined, { NODE_ENV: "test" })).toEqual({
      allowed: true,
      reason: "development_bypass"
    });
  });

  it("refuses everything in production when no token is configured", () => {
    expect(evaluateAccess("anything", { NODE_ENV: "production" })).toEqual({
      allowed: false,
      reason: "token_not_configured"
    });
  });
});

describe("safeEqual", () => {
  it("compares strings of different lengths without throwing", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("token", "token")).toBe(true);
  });
});

describe("sanitizeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(sanitizeNextPath("/active?page=2")).toBe("/active?page=2");
  });

  it("falls back for external, protocol-relative, or login targets", () => {
    expect(sanitizeNextPath("https://evil.example")).toBe("/");
    expect(sanitizeNextPath("//evil.example")).toBe("/");
    expect(sanitizeNextPath("/login?next=/active")).toBe("/");
    expect(sanitizeNextPath(undefined)).toBe("/");
  });
});
