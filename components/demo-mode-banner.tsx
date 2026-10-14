"use client";

import { useDemoMode } from "@/components/demo-mode-provider";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo-mode";

/**
 * Reads the flag from context rather than process.env so the banner renders
 * identically on the server and in the browser (AppShell is also rendered
 * inside client components, where process.env is unavailable).
 */
export function DemoModeBanner() {
  const demoMode = useDemoMode();

  if (!demoMode) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 sm:px-6"
      role="status"
    >
      <span className="font-semibold">Read-only demo.</span> {DEMO_READ_ONLY_MESSAGE}
    </div>
  );
}
