import { archiveStaleActiveJobs } from "@/lib/db/repository";
import { isPublicDemoMode } from "@/lib/demo-mode";

export const STALE_ARCHIVE_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type StaleArchiveSweepResult =
  | { status: "ran"; archivedCount: number }
  | { status: "skipped"; reason: "demo" | "throttled" }
  | { status: "failed"; error: string };

/**
 * Module-level throttle: the sweep runs at most once per 24 hours per server
 * instance. On serverless hosts the module state resets on every cold start,
 * so a fresh instance may sweep sooner; the query is cheap when nothing is
 * stale, and archiving is idempotent.
 */
let lastSweepStartedAt: number | null = null;

export function resetStaleArchiveSweepForTests() {
  lastSweepStartedAt = null;
}

/**
 * Called from the server render path of "/" and "/active". It must never
 * break the page: failures are logged and reported in the result instead of
 * thrown.
 */
export async function runStaleArchiveSweepIfDue(
  now = new Date()
): Promise<StaleArchiveSweepResult> {
  if (isPublicDemoMode()) {
    return { status: "skipped", reason: "demo" };
  }

  const nowMs = now.getTime();
  if (
    lastSweepStartedAt !== null &&
    nowMs - lastSweepStartedAt < STALE_ARCHIVE_SWEEP_INTERVAL_MS
  ) {
    return { status: "skipped", reason: "throttled" };
  }

  // Claim the slot before awaiting so concurrent renders do not both sweep.
  const previous = lastSweepStartedAt;
  lastSweepStartedAt = nowMs;

  try {
    const { archivedIds } = await archiveStaleActiveJobs(now);
    if (archivedIds.length > 0) {
      console.info(
        `[stale-archive] Archived ${archivedIds.length} Active record(s) with no response for over a year.`
      );
    }
    return { status: "ran", archivedCount: archivedIds.length };
  } catch (error) {
    // Let the next render retry instead of waiting a full day.
    lastSweepStartedAt = previous;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stale-archive] Sweep failed: ${message}`);
    return { status: "failed", error: message };
  }
}
