import { isPublicDemo } from "@/lib/demo";
import type { DailyGoalsState, JobRecord } from "@/lib/types";
import { getEasternDateKey } from "@/lib/utils";

export interface DemoEmailExample {
  id: string;
  label: string;
  body: string;
}

export interface SeedState {
  activeJobs: JobRecord[];
  rejectedJobs: JobRecord[];
  dailyGoals: DailyGoalsState;
  rejectionEmails: DemoEmailExample[];
}

const defaultSeedAnchor = new Date("2026-03-06T18:00:00.000Z");
const demoSeedAnchor = new Date("2026-03-07T18:00:00.000Z");

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

function cloneRejectionEmails(items: DemoEmailExample[]) {
  return items.map((item) => ({ ...item }));
}

function cloneSeedState(seed: SeedState, date = new Date()): SeedState {
  return {
    activeJobs: cloneJobs(seed.activeJobs),
    rejectedJobs: cloneJobs(seed.rejectedJobs),
    dailyGoals: cloneDailyGoals(seed.dailyGoals, date),
    rejectionEmails: cloneRejectionEmails(seed.rejectionEmails)
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
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    }
  ],
  dailyGoals: {
    dateKey: getEasternDateKey(defaultSeedAnchor),
    goals: {
      apply: { label: "Apply", count: 0, target: 50 },
      connect: { label: "Connect", count: 1, target: 3 },
      follow: { label: "Follow", count: 0, target: 2 }
    }
  },
  rejectionEmails: [
    {
      id: "demo-email-1",
      label: "TikTok rejection demo",
      body: `Hi Keshi,\n\nThank you for your interest in the Data Analyst opportunity at TikTok. After careful review, we will not be moving forward with your application at this time.\n\nWe appreciate the time you invested and encourage you to apply again in the future.\n\nTikTok Recruiting`
    },
    {
      id: "demo-email-2",
      label: "Tesla rejection demo",
      body: `Hello,\n\nWe appreciate your interest in the Logistics Planning Engineer role with Tesla Shanghai. After reviewing your background, we have chosen to move forward with other candidates whose experience more closely aligns with our current needs.\n\nThank you again for applying.\n\nTesla Recruiting`
    }
  ]
};

const publicDemoSeedStateBase: SeedState = {
  activeJobs: [
    {
      id: "demo-active-1",
      roleTitle: "Data Analyst",
      company: "TikTok",
      location: "San Jose, CA",
      link: "https://careers.tiktok.com/job/detail/987654321",
      jobDescription:
        "Build dashboards, investigate funnel shifts, and partner with product managers on growth analytics.",
      timestamp: offsetTimestamp(demoSeedAnchor, 3),
      pool: "active",
      comments: "Applied. Waiting on recruiter screen.",
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "demo-active-2",
      roleTitle: "Senior Data Analyst",
      company: "TikTok",
      location: "San Jose, CA",
      link: "https://jobs.bytedance.com/en/position/123456",
      jobDescription:
        "Own KPI definitions, design self-serve reporting, and align with operations partners across North America.",
      timestamp: offsetTimestamp(demoSeedAnchor, 9),
      pool: "active",
      comments: "",
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "demo-active-3",
      roleTitle: "Entry-Level Implementation Analyst | Fintech | Remote US",
      company: "Pi3AI",
      location: "United States (Remote)",
      link: "",
      jobDescription:
        "Support implementation of financial automation and reconciliation projects, document workflows, and help clients stabilize new operating flows.",
      timestamp: offsetTimestamp(demoSeedAnchor, 14),
      pool: "active",
      comments: "Saved from pasted job text to demo the no-link path.",
      sourceType: "linkedin",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "demo-active-4",
      roleTitle: "Logistics Planning Engineer",
      company: "Tesla",
      location: "Shanghai, China",
      link: "https://www.tesla.com/careers/search/job/logistics-planning-engineer-22131",
      jobDescription:
        "Coordinate material flows, optimize routing, and collaborate with manufacturing planners on network resilience.",
      timestamp: offsetTimestamp(demoSeedAnchor, 26),
      pool: "active",
      comments: "OA submitted. Waiting for follow-up.",
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "confirmed"
    },
    {
      id: "demo-active-5",
      roleTitle: "Business Operations Analyst",
      company: "ZURU",
      location: "Remote",
      link: "https://boards.greenhouse.io/zuru/jobs/873221",
      jobDescription:
        "Analyze demand trends, partner with finance, and turn unstructured operational signals into decision-ready reports.",
      timestamp: offsetTimestamp(demoSeedAnchor, 41),
      pool: "active",
      comments: "First-round interview scheduled.",
      sourceType: "greenhouse",
      sourceConfidence: "high",
      extractionStatus: "confirmed"
    }
  ],
  rejectedJobs: [
    {
      id: "demo-rejected-1",
      roleTitle: "Junior SQL Analyst",
      company: "Paradigm Technology",
      location: "100% REMOTE",
      link: "",
      jobDescription:
        "Seeking a Junior SQL Analyst to write, optimize, and maintain SQL queries to support reporting, analytics, and data validation.",
      timestamp: offsetTimestamp(demoSeedAnchor, 58),
      pool: "rejected",
      comments: "",
      sourceType: "linkedin",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "demo-rejected-2",
      roleTitle: "Product Data Analyst",
      company: "Canva",
      location: "Remote",
      link: "https://www.canva.com/careers/product-data-analyst",
      jobDescription:
        "Drive experimentation analysis, partner with designers, and communicate product insights clearly.",
      timestamp: offsetTimestamp(demoSeedAnchor, 72),
      pool: "rejected",
      comments: "",
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    },
    {
      id: "demo-rejected-3",
      roleTitle: "Revenue Analyst",
      company: "Stripe",
      location: "Toronto, ON",
      link: "https://stripe.com/jobs/listing/revenue-analyst",
      jobDescription:
        "Model revenue performance, synthesize trends, and support forecasting decisions with finance partners.",
      timestamp: offsetTimestamp(demoSeedAnchor, 96),
      pool: "rejected",
      comments: "",
      sourceType: "company",
      sourceConfidence: "low",
      extractionStatus: "needs_review"
    }
  ],
  dailyGoals: {
    dateKey: getEasternDateKey(demoSeedAnchor),
    goals: {
      apply: { label: "Apply", count: 3, target: 6 },
      connect: { label: "Connect", count: 1, target: 3 },
      follow: { label: "Follow", count: 1, target: 2 }
    }
  },
  rejectionEmails: [
    {
      id: "demo-email-1",
      label: "TikTok rejection demo",
      body: `Hi,\n\nThank you for your interest in the Data Analyst opportunity at TikTok. After careful review, we will not be moving forward with your application at this time.\n\nWe appreciate your time and encourage you to apply again in the future.\n\nTikTok Recruiting`
    },
    {
      id: "demo-email-2",
      label: "Tesla rejection demo",
      body: `Hello,\n\nWe appreciate your interest in the Logistics Planning Engineer role with Tesla Shanghai. After reviewing your background, we have chosen to move forward with other candidates whose experience more closely aligns with our current needs.\n\nThank you again for applying.\n\nTesla Recruiting`
    }
  ]
};

export function getDefaultSeedState(date = new Date()) {
  return cloneSeedState(defaultSeedStateBase, date);
}

export function getPublicDemoSeedState(date = new Date()) {
  return cloneSeedState(publicDemoSeedStateBase, date);
}

export function getSeedStateForEnvironment(date = new Date()) {
  return isPublicDemo() ? getPublicDemoSeedState(date) : getDefaultSeedState(date);
}

export function getRejectionEmailExamplesForEnvironment() {
  return getSeedStateForEnvironment().rejectionEmails;
}

const defaultSeedState = getDefaultSeedState(defaultSeedAnchor);
const publicDemoSeedState = getPublicDemoSeedState(demoSeedAnchor);

export const seedActiveJobs = defaultSeedState.activeJobs;
export const seedRejectedJobs = defaultSeedState.rejectedJobs;
export const seedDailyGoals = defaultSeedState.dailyGoals;
export const demoRejectionEmails = defaultSeedState.rejectionEmails;
export const publicDemoActiveJobs = publicDemoSeedState.activeJobs;
export const publicDemoRejectedJobs = publicDemoSeedState.rejectedJobs;
export const publicDemoDailyGoals = publicDemoSeedState.dailyGoals;
export const publicDemoRejectionEmails = publicDemoSeedState.rejectionEmails;
