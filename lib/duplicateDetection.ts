import type { DuplicateCandidate, JobDraft, JobRecord } from "@/lib/types";
import { normalizeText, tokenOverlapScore } from "@/lib/utils";

function scoreDuplicate(draft: JobDraft, record: JobRecord) {
  let score = 0;
  const reasons: string[] = [];

  if (normalizeText(draft.company) === normalizeText(record.company)) {
    score += 0.45;
    reasons.push("Same company");
  }

  const roleScore = tokenOverlapScore(draft.roleTitle, record.roleTitle);
  if (roleScore > 0.35) {
    score += roleScore * 0.35;
    reasons.push("Role title is similar");
  }

  const descriptionScore = tokenOverlapScore(
    draft.jobDescription,
    record.jobDescription
  );
  if (descriptionScore > 0.18) {
    score += descriptionScore * 0.2;
    reasons.push("Job description overlaps");
  }

  if (draft.link.trim() && normalizeText(draft.link) === normalizeText(record.link)) {
    score += 0.3;
    reasons.push("Link matches exactly");
  }

  return { score, reasons };
}

export function findDuplicateCandidates(
  draft: JobDraft,
  records: JobRecord[],
  threshold = 0.55
) {
  return records
    .map((record) => {
      const result = scoreDuplicate(draft, record);
      return {
        record,
        score: result.score,
        reasons: result.reasons
      } satisfies DuplicateCandidate;
    })
    .filter((candidate) => candidate.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
