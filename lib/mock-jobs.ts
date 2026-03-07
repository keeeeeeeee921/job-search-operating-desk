export interface MockJobDefinition {
  slug: string;
  title: string;
  company: string;
  location: string;
  description: string;
}

export const mockJobs: MockJobDefinition[] = [
  {
    slug: "aurora-data-analyst",
    title: "Data Analyst",
    company: "Aurora Labs",
    location: "Toronto, ON",
    description:
      "Analyze growth funnels, build recurring KPI reporting, and turn ambiguous product questions into measurable decision support."
  },
  {
    slug: "tiktok-data-analyst-duplicate",
    title: "Data Analyst",
    company: "TikTok",
    location: "San Jose, CA",
    description:
      "Build dashboards, investigate funnel shifts, and partner with product managers on growth analytics."
  },
  {
    slug: "zuru-business-analyst",
    title: "Business Analyst",
    company: "ZURU",
    location: "Remote",
    description:
      "Support commercial reporting, evaluate operational efficiency, and maintain planning models for cross-functional teams."
  }
];

export function getMockJobBySlug(slug: string) {
  return mockJobs.find((job) => job.slug === slug);
}
