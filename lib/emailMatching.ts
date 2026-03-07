import type { EmailMatch, JobRecord } from "@/lib/types";
import { normalizeText, tokenOverlapScore } from "@/lib/utils";

export function findEmailMatches(emailText: string, records: JobRecord[]) {
  const normalizedEmail = normalizeText(emailText);

  return records
    .map((record) => {
      let score = 0;
      const reasons: string[] = [];

      if (
        normalizedEmail.includes(normalizeText(record.company)) &&
        record.company.trim()
      ) {
        score += 0.45;
        reasons.push("Company appears in the email");
      }

      const roleScore = tokenOverlapScore(emailText, record.roleTitle);
      if (roleScore > 0.1) {
        score += roleScore * 0.25;
        reasons.push("Role wording overlaps");
      }

      const descriptionScore = tokenOverlapScore(
        emailText,
        record.jobDescription
      );
      if (descriptionScore > 0.08) {
        score += descriptionScore * 0.15;
        reasons.push("Description keywords overlap");
      }

      const daysSinceSaved =
        (Date.now() - new Date(record.timestamp).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceSaved <= 21) {
        score += 0.15;
        reasons.push("Saved recently");
      }

      return { record, score, reasons } satisfies EmailMatch;
    })
    .filter((item) => item.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
