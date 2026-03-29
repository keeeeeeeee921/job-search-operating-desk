import { revalidatePath } from "next/cache";

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateAfterActiveRecordSaved(_recordId: string) {
  revalidatePaths(["/", "/active", "/analytics"]);
}

export function revalidateAfterActiveRecordArchived() {
  revalidatePaths(["/", "/active", "/rejected", "/analytics"]);
}

export function revalidateAfterActiveRecordDeleted() {
  revalidatePaths(["/", "/active", "/analytics"]);
}

export function revalidateAfterCommentsUpdated(recordId: string) {
  revalidatePaths([`/active/${recordId}`]);
}

export function revalidateAfterStageUpdated(recordId: string) {
  revalidatePaths([`/active/${recordId}`, "/analytics"]);
}

export function revalidateAfterDailyGoalsUpdated() {
  revalidatePath("/");
}
