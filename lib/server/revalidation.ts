import { revalidatePath } from "next/cache";

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateAfterActiveRecordSaved(_recordId: string) {
  revalidatePaths(["/", "/active", "/search-log"]);
}

export function revalidateAfterActiveRecordArchived() {
  revalidatePaths(["/", "/active", "/rejected", "/search-log"]);
}

export function revalidateAfterActiveRecordDeleted() {
  revalidatePaths(["/", "/active", "/search-log"]);
}

export function revalidateAfterCommentsUpdated(recordId: string) {
  revalidatePaths([`/active/${recordId}`, "/search-log"]);
}

export function revalidateAfterStageUpdated(recordId: string) {
  revalidatePaths(["/active", `/active/${recordId}`, "/search-log"]);
}

export function revalidateAfterDailyGoalsUpdated() {
  revalidatePath("/");
}
