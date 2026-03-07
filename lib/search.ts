import type { JobRecord } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

export function searchActiveJobs(records: JobRecord[], query: string) {
  const normalizedQuery = normalizeText(query);

  return records
    .filter((record) => record.pool === "active")
    .filter((record) => {
      if (!normalizedQuery) {
        return true;
      }

      const composite = normalizeText(
        `${record.company} ${record.roleTitle} ${record.location}`
      );
      return composite.includes(normalizedQuery);
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}
