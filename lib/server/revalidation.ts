import { revalidatePath } from "next/cache";

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateAfterActiveRecordSaved(_recordId: string) {
  revalidatePaths(["/", "/active", "/search", "/update-by-email"]);
}

export function revalidateAfterActiveRecordArchived() {
  revalidatePaths(["/", "/active", "/rejected", "/search", "/update-by-email"]);
}

export function revalidateAfterActiveRecordDeleted() {
  revalidatePaths(["/", "/active", "/search", "/update-by-email"]);
}

export function revalidateAfterCommentsUpdated(recordId: string) {
  revalidatePaths([`/active/${recordId}`]);
}

export function revalidateAfterDailyGoalsUpdated() {
  revalidatePath("/");
}

export function revalidateAfterDemoReset() {
  revalidatePaths(["/", "/active", "/rejected", "/search", "/update-by-email"]);
}
