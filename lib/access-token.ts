/**
 * Access-token helpers shared by the Edge middleware, server actions, and API
 * routes. Everything here must stay runtime-agnostic (no `next/headers`,
 * no Node-only modules) so it can run inside `middleware.ts`.
 */

export const ACCESS_COOKIE_NAME = "job_desk_token";
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const UNAUTHORIZED_MESSAGE =
  "This action requires a valid access token. Sign in at /login first.";
export const TOKEN_NOT_CONFIGURED_MESSAGE =
  "JOB_DESK_ACCESS_TOKEN is not configured. Set it in the environment before serving this deployment.";

export type AccessDecision =
  | { allowed: true; reason: "token_match" | "development_bypass" }
  | { allowed: false; reason: "token_not_configured" | "token_mismatch" };

type AccessEnv = {
  JOB_DESK_ACCESS_TOKEN?: string;
  NODE_ENV?: string;
};

export function getConfiguredAccessToken(env: AccessEnv = process.env) {
  const value = env.JOB_DESK_ACCESS_TOKEN?.trim();
  return value ? value : null;
}

/**
 * Constant-time string comparison so the token cannot be guessed one
 * character at a time by measuring response latency.
 */
export function safeEqual(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

/**
 * Decide whether a request carrying `candidate` (the cookie value or the
 * value typed on the login page) may proceed.
 *
 * - Token configured: the candidate must match exactly.
 * - Token missing outside production (`next dev`, vitest): allow, so local
 *   work does not need a token.
 * - Token missing in production: refuse. A public deployment must never run
 *   without a token.
 */
export function evaluateAccess(
  candidate: string | undefined,
  env: AccessEnv = process.env
): AccessDecision {
  const expected = getConfiguredAccessToken(env);

  if (!expected) {
    return env.NODE_ENV === "production"
      ? { allowed: false, reason: "token_not_configured" }
      : { allowed: true, reason: "development_bypass" };
  }

  return safeEqual(candidate ?? "", expected)
    ? { allowed: true, reason: "token_match" }
    : { allowed: false, reason: "token_mismatch" };
}

/**
 * Only allow same-origin relative paths as post-login destinations so the
 * login form cannot be turned into an open redirect.
 */
export function sanitizeNextPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.startsWith("/login")
  ) {
    return fallback;
  }

  return trimmed;
}
