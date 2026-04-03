import { jobStages, type JobStage } from "@/lib/types";

const validJobStages = new Set<JobStage>(jobStages);

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  applied: "Applied",
  hr_reach_out: "HR outreach",
  oa: "OA",
  first_round: "1st round interview",
  second_plus_round: "2nd+ round interview",
  offer: "Offer"
};

const STAGE_RULES: Array<{ stage: JobStage; patterns: RegExp[] }> = [
  {
    stage: "offer",
    patterns: [/\boffer\b/i, /\bverbal offer\b/i, /\boffer extended\b/i]
  },
  {
    stage: "second_plus_round",
    patterns: [
      /\bfinal round\b/i,
      /\bonsite\b/i,
      /\bon-site\b/i,
      /\bon site\b/i,
      /\bpanel\b/i,
      /\bsuperday\b/i,
      /\bsecond round\b/i,
      /\b2nd round\b/i,
      /\bthird round\b/i,
      /\b3rd round\b/i
    ]
  },
  {
    stage: "first_round",
    patterns: [
      /\bfirst round\b/i,
      /\b1st round\b/i,
      /\bphone screen\b/i,
      /\binterview scheduled\b/i,
      /\bhiring manager interview\b/i
    ]
  },
  {
    stage: "oa",
    patterns: [
      /\boa\b/i,
      /\bonline assessment\b/i,
      /\bcodesignal\b/i,
      /\bhackerrank\b/i
    ]
  },
  {
    stage: "hr_reach_out",
    patterns: [
      /\brecruiter\b/i,
      /\bhr reached out\b/i,
      /\breach out\b/i,
      /\bscreening call\b/i
    ]
  }
];

export function coerceJobStage(value: string | null | undefined): JobStage {
  if (value && validJobStages.has(value as JobStage)) {
    return value as JobStage;
  }

  return "applied";
}

export function formatJobStageLabel(stage: JobStage) {
  return JOB_STAGE_LABELS[stage];
}

export function inferStageFromComments(comments: string | null | undefined): JobStage {
  const source = comments?.trim() ?? "";
  if (!source) {
    return "applied";
  }

  for (const rule of STAGE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(source))) {
      return rule.stage;
    }
  }

  return "applied";
}
