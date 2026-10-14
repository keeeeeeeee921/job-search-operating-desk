import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginWithAccessToken } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { getConfiguredAccessToken, sanitizeNextPath } from "@/lib/access-token";
import { isCurrentRequestAuthorized } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Sign in | Job Search Operating Desk",
  robots: { index: false, follow: false }
};

const errorMessages: Record<string, string> = {
  token_mismatch: "That token didn't match. Check the value and try again.",
  token_not_configured:
    "JOB_DESK_ACCESS_TOKEN is not set on this deployment, so nobody can sign in yet."
};

function readStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const nextPath = sanitizeNextPath(readStringParam(params.next));

  if (await isCurrentRequestAuthorized()) {
    redirect(nextPath);
  }

  const errorCode = readStringParam(params.error);
  const errorMessage = errorMessages[errorCode] ?? null;
  const tokenConfigured = Boolean(getConfiguredAccessToken());

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10 text-foreground">
      <Surface className="w-full max-w-md p-6 sm:p-8">
        <p className="text-sm font-semibold text-accent">Private workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Enter the access token
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This desk holds real application records. The token is set in the
          deployment environment and stays in an HTTP-only cookie for 30 days.
        </p>

        <form action={loginWithAccessToken} className="mt-6 space-y-4">
          <input name="next" type="hidden" value={nextPath} />
          <div>
            <label className="text-sm font-semibold" htmlFor="access-token">
              Access token
            </label>
            <Input
              autoComplete="current-password"
              autoFocus
              className="mt-2"
              id="access-token"
              name="token"
              required
              type="password"
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-rose-700" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {!tokenConfigured && !errorMessage ? (
            <p className="text-sm text-muted-foreground">
              No token is configured in this environment, so any value signs
              you in here. Production refuses requests until one is set.
            </p>
          ) : null}
          <Button className="w-full" type="submit">
            Continue
          </Button>
        </form>
      </Surface>
    </main>
  );
}
