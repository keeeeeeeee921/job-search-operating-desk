import { revalidatePath } from "next/cache";

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateAfterActiveRecordSaved(recordId: string) {
  revalidatePaths(["/", "/active", "/search", "/update-by-email", `/active/${recordId}`]);
}

export function revalidateAfterActiveRecordRemoved(recordId: string) {
  revalidatePaths([
    "/",
    "/active",
    "/rejected",
    "/search",
    "/update-by-email",
    `/active/${recordId}`
  ]);
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
