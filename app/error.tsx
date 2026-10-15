"use client";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

/**
 * Route-level error boundary. The usual cause is the database not
 * answering for a moment, so the copy says that and offers a retry.
 * Nothing from the error object is rendered: Next already redacts server
 * messages in production, and a stack trace is useless to the reader.
 */
export default function RouteError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell currentPath="">
      <Surface className="mx-auto max-w-xl p-8 text-center" role="alert">
        <p className="text-sm font-semibold text-accent">Something went wrong</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          The desk couldn&apos;t load its data right now
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This is usually the database taking a moment to answer. Nothing you
          saved is lost. Try again in a few seconds.
        </p>
        <div className="mt-5">
          <Button onClick={() => reset()} type="button">
            Try again
          </Button>
        </div>
      </Surface>
    </AppShell>
  );
}
