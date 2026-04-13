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
    slug: "ibm-canada-associate-business-analyst-duplicate",
    title: "Associate Business Analyst - Entry Level",
    company: "IBM Canada",
    location: "Toronto, ON",
    description:
      "Support reporting, clarify requirements, and translate business questions into datasets and dashboards."
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
