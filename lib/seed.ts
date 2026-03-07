import type { DailyGoalsState, JobRecord } from "@/lib/types";
import { getEasternDateKey } from "@/lib/utils";

const now = new Date("2026-03-06T18:00:00.000Z");

export const seedActiveJobs: JobRecord[] = [
  {
    id: "seed-active-1",
    roleTitle: "Data Analyst",
    company: "TikTok",
    location: "San Jose, CA",
    link: "https://careers.tiktok.com/job/detail/987654321",
    jobDescription:
      "Build dashboards, investigate funnel shifts, and partner with product managers on growth analytics.",
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
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
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
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
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 26).toISOString(),
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
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 40).toISOString(),
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
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 55).toISOString(),
    pool: "active",
    comments: "First round interview scheduled.",
    sourceType: "greenhouse",
    sourceConfidence: "high",
    extractionStatus: "confirmed"
  }
];

export const seedRejectedJobs: JobRecord[] = [
  {
    id: "seed-rejected-1",
    roleTitle: "Product Data Analyst",
    company: "Canva",
    location: "Remote",
    link: "https://www.canva.com/careers/product-data-analyst",
    jobDescription:
      "Drive experimentation analysis, partner with designers, and communicate product insights clearly.",
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
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
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 96).toISOString(),
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
    timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 130).toISOString(),
    pool: "rejected",
    comments: "",
    sourceType: "company",
    sourceConfidence: "low",
    extractionStatus: "needs_review"
  }
];

export const seedDailyGoals: DailyGoalsState = {
  dateKey: getEasternDateKey(now),
  goals: {
    apply: { label: "Apply", count: 0, target: 50 },
    connect: { label: "Connect", count: 1, target: 3 },
    follow: { label: "Follow", count: 0, target: 2 }
  }
};

export const demoRejectionEmails = [
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
];
