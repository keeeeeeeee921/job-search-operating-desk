import { DAILY_GOALS_DEFAULTS } from "@/lib/daily-goals-defaults";
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
      roleTitle: "Data Analyst",
      company: "TikTok",
      location: "San Jose, CA",
      link: "https://careers.tiktok.com/job/detail/987654321",
      jobDescription:
        "Build dashboards, investigate funnel shifts, and partner with product managers on growth analytics.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 5),
      pool: "active",
      comments: "Applied. Waiting for recruiter response.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-active-2",
      roleTitle: "Senior Data Analyst",
      company: "TikTok",
      location: "San Jose, CA",
      link: "https://jobs.bytedance.com/en/position/123456",
      jobDescription:
        "Own KPI definitions, design self-serve reporting, and align with operations partners across North America.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 12),
      pool: "active",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-active-3",
      roleTitle: "Logistics Planning Engineer",
      company: "Tesla",
      location: "Shanghai, China",
      link: "https://www.tesla.com/careers/search/job/logistics-planning-engineer-22131",
      jobDescription:
        "Coordinate material flows, optimize routing, and collaborate with manufacturing planners on network resilience.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 26),
      pool: "active",
      comments: "OA expected next week.",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "confirmed"
    },
    {
      id: "seed-active-4",
      roleTitle: "Business Analyst",
      company: "ZURU",
      location: "Remote",
      link: "https://jobs.lever.co/zuru/ba-remote-2026",
      jobDescription:
        "Support commercial reporting, evaluate operational efficiency, and maintain planning models for cross-functional teams.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 40),
      pool: "active",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "lever",
      sourceConfidence: "high",
      extractionStatus: "confirmed"
    },
    {
      id: "seed-active-5",
      roleTitle: "Business Operations Analyst",
      company: "ZURU",
      location: "Remote",
      link: "https://boards.greenhouse.io/zuru/jobs/873221",
      jobDescription:
        "Analyze demand trends, partner with finance, and turn unstructured operational signals into decision-ready reports.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 55),
      pool: "active",
      comments: "First round interview scheduled.",
      applyCountedDateKey: null,
      sourceType: "greenhouse",
      sourceConfidence: "high",
      extractionStatus: "confirmed"
    }
  ],
  rejectedJobs: [
    {
      id: "seed-rejected-1",
      roleTitle: "Product Data Analyst",
      company: "Canva",
      location: "Remote",
      link: "https://www.canva.com/careers/product-data-analyst",
      jobDescription:
        "Drive experimentation analysis, partner with designers, and communicate product insights clearly.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 72),
      pool: "rejected",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-2",
      roleTitle: "Operations Analyst",
      company: "Shopify",
      location: "Remote",
      link: "https://www.shopify.com/careers/operations-analyst-2026",
      jobDescription:
        "Improve support workflows, monitor operations metrics, and build weekly reporting packages.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 96),
      pool: "rejected",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "seed-rejected-3",
      roleTitle: "Revenue Analyst",
      company: "Stripe",
      location: "Toronto, ON",
      link: "https://stripe.com/jobs/listing/revenue-analyst",
      jobDescription:
        "Model revenue performance, synthesize trends, and support forecasting decisions with finance partners.",
      timestamp: offsetTimestamp(defaultSeedAnchor, 130),
      pool: "rejected",
      comments: "",
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
