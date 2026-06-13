import { DAILY_GOALS_DEFAULTS } from "@/lib/daily-goals-defaults";
import { SEARCH_01_LABEL } from "@/lib/search-cycle";
import type { DailyGoalsState, JobRecord } from "@/lib/types";
import { getEasternDateKey } from "@/lib/utils";

export interface SeedState {
  activeJobs: JobRecord[];
  rejectedJobs: JobRecord[];
  dailyGoals: DailyGoalsState;
}

const defaultSeedAnchor = new Date("2026-03-06T18:00:00.000Z");

function offsetTimestamp(anchor: Date, hoursAgo: number) {
  return new Date(anchor.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function cloneJobs(records: JobRecord[]) {
  return records.map((record) => ({ ...record }));
}

function cloneDailyGoals(state: DailyGoalsState, date = new Date()): DailyGoalsState {
  return {
    dateKey: getEasternDateKey(date),
    goals: {
      apply: { ...state.goals.apply },
      connect: { ...state.goals.connect },
      follow: { ...state.goals.follow }
    }
  };
}

function cloneSeedState(seed: SeedState, date = new Date()): SeedState {
  return {
    activeJobs: cloneJobs(seed.activeJobs),
    rejectedJobs: cloneJobs(seed.rejectedJobs),
    dailyGoals: cloneDailyGoals(seed.dailyGoals, date)
  };
}

const defaultSeedStateBase: SeedState = {
  activeJobs: [
    {
      id: "seed-active-1",
      roleTitle: "Associate Business Analyst - Entry Level",
      company: "IBM Canada",
      location: "Toronto, ON",
      link: "https://example.com/jobs/ibm-canada-associate-business-analyst",
      jobDescription:
        "Support reporting, clarify requirements, and translate business questions into datasets and dashboards.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 5),
      pool: "active",
      stage: "no_response",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Screening scheduled.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-active-2",
      roleTitle: "Research Analyst",
      company: "NYC Tourism + Conventions",
      location: "New York, NY",
      link: "https://example.com/jobs/nyc-tourism-research-analyst",
      jobDescription:
        "Analyze visitor trends, build reporting, and support stakeholder briefings.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 12),
      pool: "active",
      stage: "no_response",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Applied.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-active-3",
      roleTitle: "Business Analyst",
      company: "ZURU Toys",
      location: "Remote",
      link: "https://example.com/jobs/zuru-business-analyst",
      jobDescription:
        "Support planning models, analyze operational metrics, and share insights with cross-functional teams.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 26),
      pool: "active",
      stage: "no_response",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "First round interview completed.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "confirmed"
    },
    {
      id: "seed-active-4",
      roleTitle: "Data Analyst",
      company: "Nomura",
      location: "New York, NY",
      link: "https://example.com/jobs/nomura-data-analyst",
      jobDescription:
        "Build dashboards, validate datasets, and partner with stakeholders on analytics requests.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 40),
      pool: "active",
      stage: "no_response",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Screening notes captured.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-active-5",
      roleTitle: "Data Analyst",
      company: "L'Oréal",
      location: "New York, NY",
      link: "https://example.com/jobs/loreal-data-analyst",
      jobDescription:
        "Track performance metrics, build weekly reports, and support experimentation analysis.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 55),
      pool: "active",
      stage: "no_response",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Recruiter follow-up pending.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-active-6",
      roleTitle: "Ops Research Scientist I",
      company: "Federal Express Corporation",
      location: "Memphis, TN",
      link: "https://example.com/jobs/fedex-ops-research-scientist",
      jobDescription:
        "Develop models, run analyses, and support operational optimization projects.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 68),
      pool: "active",
      stage: "no_response",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Screening completed.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    }
  ],
  rejectedJobs: [
    {
      id: "seed-rejected-1",
      roleTitle: "Data Analyst (Contractor)",
      company: "Digital Reach Agency",
      location: "Remote",
      link: "https://example.com/jobs/digital-reach-data-analyst",
      jobDescription:
        "Support client reporting, clean datasets, and deliver weekly performance summaries.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 72),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-2",
      roleTitle: "Data Scientist Intern",
      company: "Corsair",
      location: "Remote",
      link: "https://example.com/jobs/corsair-data-scientist-intern",
      jobDescription:
        "Analyze usage data, build models, and support product analytics experiments.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 96),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after first round.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-3",
      roleTitle: "Business Analyst",
      company: "Valon",
      location: "New York, NY",
      link: "https://example.com/jobs/valon-business-analyst",
      jobDescription:
        "Support operations reporting, document metrics, and synthesize insights for leadership.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 130),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-4",
      roleTitle: "Data Analyst",
      company: "Jerry.ai",
      location: "Remote",
      link: "https://example.com/jobs/jerry-ai-data-analyst",
      jobDescription:
        "Analyze user funnel performance and support growth reporting.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 150),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-5",
      roleTitle: "Data Analyst",
      company: "CarMax",
      location: "Remote",
      link: "https://example.com/jobs/carmax-data-analyst",
      jobDescription:
        "Track performance metrics, maintain dashboards, and support analytics requests.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 170),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after first round.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-6",
      roleTitle: "Data Analyst",
      company: "Axon",
      location: "Remote",
      link: "https://example.com/jobs/axon-data-analyst",
      jobDescription:
        "Support analytics reporting, align datasets, and maintain data quality checks.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 190),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-7",
      roleTitle: "Data Analyst",
      company: "FedEx",
      location: "Memphis, TN",
      link: "https://example.com/jobs/fedex-data-analyst",
      jobDescription:
        "Support operational reporting, maintain dashboards, and document recurring analysis.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 210),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-8",
      roleTitle: "Business Analyst",
      company: "ZURU Toys",
      location: "Remote",
      link: "https://example.com/jobs/zuru-business-analyst-rejected",
      jobDescription:
        "Support planning models, analyze operational metrics, and share insights with cross-functional teams.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 230),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after later-stage interviews.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-9",
      roleTitle: "Business Analyst",
      company: "IBM Canada",
      location: "Toronto, ON",
      link: "https://example.com/jobs/ibm-canada-business-analyst-rejected",
      jobDescription:
        "Translate business questions into datasets and dashboards for internal partners.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 250),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-10",
      roleTitle: "Research Analyst",
      company: "NYC Tourism + Conventions",
      location: "New York, NY",
      link: "https://example.com/jobs/nyc-tourism-research-analyst-rejected",
      jobDescription:
        "Analyze tourism trends, prepare summaries, and support stakeholder reporting.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 270),
      pool: "rejected",
      stage: "rejected",
      searchCycleLabel: SEARCH_01_LABEL,
      comments: "Rejected after screening.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    }
  ],
  dailyGoals: {
    dateKey: getEasternDateKey(defaultSeedAnchor),
    goals: {
      apply: {
        label: "Apply",
        count: DAILY_GOALS_DEFAULTS.apply.count,
        target: DAILY_GOALS_DEFAULTS.apply.target
      },
      connect: {
        label: "Connect",
        count: DAILY_GOALS_DEFAULTS.connect.count,
        target: DAILY_GOALS_DEFAULTS.connect.target
      },
      follow: {
        label: "Follow",
        count: DAILY_GOALS_DEFAULTS.follow.count,
        target: DAILY_GOALS_DEFAULTS.follow.target
      }
    }
  }
};

export function getDefaultSeedState(date = new Date()) {
  return cloneSeedState(defaultSeedStateBase, date);
}

const defaultSeedState = getDefaultSeedState(defaultSeedAnchor);

export const seedActiveJobs = defaultSeedState.activeJobs;
export const seedRejectedJobs = defaultSeedState.rejectedJobs;
export const seedDailyGoals = defaultSeedState.dailyGoals;
