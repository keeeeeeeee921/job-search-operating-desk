import { revalidatePath } from "next/cache";

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateAfterActiveRecordSaved(_recordId: string) {
  revalidatePaths(["/", "/active"]);
}

export function revalidateAfterActiveRecordArchived() {
  revalidatePaths(["/", "/active", "/rejected"]);
}

export function revalidateAfterActiveRecordDeleted() {
  revalidatePaths(["/", "/active"]);
}

export function revalidateAfterCommentsUpdated(recordId: string) {
  revalidatePaths([`/active/${recordId}`]);
}

export function revalidateAfterDailyGoalsUpdated() {
  revalidatePath("/");
}
