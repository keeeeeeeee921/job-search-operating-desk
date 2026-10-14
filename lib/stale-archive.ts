import type { JobRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * An Active record that has sat at "No Response" for more than this many
 * days is treated as a silent rejection and archived automatically.
 */
export const STALE_ACTIVE_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export const AUTO_ARCHIVE_NOTE_PREFIX = "Auto-archived: no response for over a year";

/** Records saved strictly before this instant are stale. */
export function getStaleActiveThreshold(now = new Date()) {
  return new Date(now.getTime() - STALE_ACTIVE_DAYS * DAY_MS);
}

export function isStaleActiveRecord(
  record: Pick<JobRecord, "pool" | "stage" | "timestamp">,
  now = new Date()
) {
  return (
    record.pool === "active" &&
    record.stage === "no_response" &&
    new Date(record.timestamp).getTime() < getStaleActiveThreshold(now).getTime()
  );
}

export function buildAutoArchiveNote(savedTimestamp: string) {
  return `${AUTO_ARCHIVE_NOTE_PREFIX} (saved ${formatDate(savedTimestamp)})`;
}

export function appendSystemNote(comments: string, note: string) {
  const existing = comments.trimEnd();
  return existing ? `${existing}\n${note}` : note;
}
