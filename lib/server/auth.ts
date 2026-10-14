import { cookies } from "next/headers";
import {
  ACCESS_COOKIE_NAME,
  evaluateAccess,
  getConfiguredAccessToken,
  TOKEN_NOT_CONFIGURED_MESSAGE,
  UNAUTHORIZED_MESSAGE,
  type AccessDecision
} from "@/lib/access-token";

async function readAccessCookie() {
  try {
    const store = await cookies();
    return store.get(ACCESS_COOKIE_NAME)?.value;
  } catch {
    // Outside a request scope (unit tests, scripts) there is no cookie jar.
    return undefined;
  }
}

/**
 * Evaluate the current request's cookie against JOB_DESK_ACCESS_TOKEN.
 * The cookie jar is only touched when a token is configured, so the
 * development bypass works without a request context.
 */
export async function getCurrentAccessDecision(): Promise<AccessDecision> {
  if (!getConfiguredAccessToken()) {
    return evaluateAccess(undefined);
  }

  return evaluateAccess(await readAccessCookie());
}

export async function isCurrentRequestAuthorized() {
  return (await getCurrentAccessDecision()).allowed;
}

export type WriteBlock = {
  kind: "unauthorized" | "token_not_configured";
  status: 401 | 503;
  message: string;
};

/**
 * Shared gate for every write path (server actions and API routes).
 * Returns `null` when the write may proceed, otherwise a description the
 * caller can surface to the client. Checked in addition to the middleware
 * so a misconfigured matcher or a direct server-action call cannot bypass it.
 */
export async function getWriteBlock(): Promise<WriteBlock | null> {
  const decision = await getCurrentAccessDecision();
  if (decision.allowed) {
    return null;
  }

  if (decision.reason === "token_not_configured") {
    return {
      kind: "token_not_configured",
      status: 503,
      message: TOKEN_NOT_CONFIGURED_MESSAGE
    };
  }

  return { kind: "unauthorized", status: 401, message: UNAUTHORIZED_MESSAGE };
}

/**
 * Gate for read-only server actions that still expose private data.
 */
export async function assertReadAllowed() {
  const decision = await getCurrentAccessDecision();
  if (!decision.allowed) {
    throw new Error(
      decision.reason === "token_not_configured"
        ? TOKEN_NOT_CONFIGURED_MESSAGE
        : UNAUTHORIZED_MESSAGE
    );
  }
}
