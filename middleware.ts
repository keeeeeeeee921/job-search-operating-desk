import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, evaluateAccess } from "@/lib/access-token";

/**
 * Paths that must stay reachable without a token:
 * - /login: where the token is entered.
 * - /robots.txt: crawlers must be able to read the disallow rule.
 * - /mock-jobs/*: synthetic postings the extractor fetches server-side when
 *   a mock link is pasted; they contain no personal data and are noindex.
 */
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/mock-jobs/")
  );
}

let loggedMissingToken = false;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const decision = evaluateAccess(request.cookies.get(ACCESS_COOKIE_NAME)?.value);
  if (decision.allowed) {
    return NextResponse.next();
  }

  const isApiRequest = pathname.startsWith("/api/");

  if (decision.reason === "token_not_configured") {
    if (!loggedMissingToken) {
      loggedMissingToken = true;
      console.error(
        "[job-desk] Refusing all requests: JOB_DESK_ACCESS_TOKEN is not set and NODE_ENV is production. " +
          "Set JOB_DESK_ACCESS_TOKEN and redeploy."
      );
    }

    const message = "Access token is not configured for this deployment.";
    return isApiRequest
      ? NextResponse.json({ error: message }, { status: 503 })
      : new NextResponse(message, {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" }
        });
  }

  if (isApiRequest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (request.method === "GET" && pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
