import { describe, expect, it } from "vitest";
import { extractJobFromText } from "@/lib/text-extractor";

type EasyApplyBaseCase = {
  id: string;
  roleTitle: string;
  company: string;
  locationExpected: string;
  summaryLocation?: string;
  postingMetaLine?: string;
  locationLabelValue?: string;
  description: string;
};

const noiseBundles: string[][] = [
  [
    "Promoted by hirer · No response insights available yet",
    "33%",
    "Resume Match",
    "Show match details",
    "Tailor my resume",
    "Create cover letter",
    "Help me stand out"
  ],
  [
    "People you can reach out to",
    "Ryan profile photo",
    "Ryan Van Echo is verified",
    "School alum from Columbia University",
    "Message"
  ],
  [
    "Starting at $25/hr",
    "On-site",
    "Contract",
    "Easy Apply",
    "Save",
    "Show more"
  ],
  [
    "Unsupported",
    "Responses managed off LinkedIn",
    "Your AI-powered job assessment",
    "You'd be a top applicant",
    "Show more options"
  ]
];

const baseCases: EasyApplyBaseCase[] = [
  {
    id: "agility-cincinnati",
    roleTitle: "Junior Data Engineer",
    company: "Agility Partners",
    locationExpected: "Cincinnati, OH",
    postingMetaLine: "Cincinnati, OH · 9 hours ago · Over 100 applicants",
    summaryLocation: "Cincinnati, OH (On-site)",
    description:
      "We’re hiring two Junior Data Engineers to modernize and transform a core householding data ecosystem."
  },
  {
    id: "emma-remote-us",
    roleTitle: "Entry-Level Implementation Analyst | Fintech | Remote US",
    company: "Emma of Torre.ai",
    locationExpected: "United States (Remote)",
    postingMetaLine: "United States · 16 minutes ago · 5 people clicked apply",
    locationLabelValue: "Remote: USA",
    summaryLocation: "United States (Remote)",
    description:
      "You'll drive financial automation and digital transformation projects for global fintech clients."
  },
  {
    id: "canva-sf",
    roleTitle: "Business Analyst",
    company: "Canva",
    locationExpected: "San Francisco, CA",
    postingMetaLine: "San Francisco, CA · 1 day ago · Over 200 applicants",
    summaryLocation: "San Francisco, CA (Hybrid)",
    description:
      "This role supports strategic planning by analyzing trends and delivering actionable business insights."
  },
  {
    id: "ttx-us",
    roleTitle: "Data Analyst III",
    company: "TTX Company",
    locationExpected: "United States (Remote)",
    postingMetaLine: "United States · 3 days ago · 20 people clicked apply",
    summaryLocation: "United States (Remote)",
    description:
      "The role supports billing transformation and enterprise analytics with practical reporting improvements."
  },
  {
    id: "pi3ai-remote",
    roleTitle: "Implementation Analyst",
    company: "Pi3AI",
    locationExpected: "United States (Remote)",
    locationLabelValue: "Remote: United States",
    summaryLocation: "United States (Remote)",
    description:
      "You will partner with finance and operations teams to configure reconciliation workflows and documentation."
  },
  {
    id: "doordash-ny",
    roleTitle: "Operations Analyst",
    company: "DoorDash",
    locationExpected: "New York, NY",
    postingMetaLine: "New York, NY · 5 hours ago · Over 75 applicants",
    summaryLocation: "New York, NY (On-site)",
    description:
      "The analyst will build reporting packs, monitor KPIs, and support fast operational decision cycles."
  },
  {
    id: "stripe-toronto",
    roleTitle: "Financial Analyst",
    company: "Stripe",
    locationExpected: "Toronto, ON",
    postingMetaLine: "Toronto, ON · 2 days ago · 14 people clicked apply",
    summaryLocation: "Toronto, ON (Hybrid)",
    description:
      "The team is looking for analytical support on forecasting, strategic planning, and market expansion analysis."
  },
  {
    id: "paradigm-remote",
    roleTitle: "Junior SQL Analyst",
    company: "Paradigm Technology",
    locationExpected: "Remote",
    locationLabelValue: "Remote",
    summaryLocation: "Remote",
    description:
      "Seeking a junior SQL analyst to optimize and maintain SQL queries for analytics and data validation."
  },
  {
    id: "rippling-austin",
    roleTitle: "Data Engineer",
    company: "Rippling",
    locationExpected: "Austin, TX",
    postingMetaLine: "Austin, TX · 11 hours ago · Over 120 applicants",
    summaryLocation: "Austin, TX (On-site)",
    description:
      "Join a data engineering team focused on reliable pipelines, metrics quality, and scalable internal tooling."
  },
  {
    id: "segra-missing-location",
    roleTitle: "Analyst, Insights",
    company: "Segra",
    locationExpected: "",
    description:
      "After carefully reviewing your background, we are unable to move forward and will continue with other applicants."
  }
];

function buildInput(
  baseCase: EasyApplyBaseCase,
  noise: string[],
  variantIndex: number
) {
  const parts = [
    `${baseCase.company} logo`,
    baseCase.company,
    "Share",
    "Show more options",
    baseCase.roleTitle
  ];

  if (baseCase.postingMetaLine) {
    parts.push(baseCase.postingMetaLine);
  }

  parts.push(...noise);
  parts.push(baseCase.roleTitle);

  if (baseCase.summaryLocation) {
    parts.push(`${baseCase.company} · ${baseCase.summaryLocation}`);
  }

  parts.push("Easy Apply");
  parts.push("Save");
  parts.push(`Save ${baseCase.roleTitle} at ${baseCase.company}`);

  if (baseCase.locationLabelValue) {
    parts.push("Location:");
    parts.push(baseCase.locationLabelValue);
  }

  parts.push("About the job");
  parts.push(baseCase.description);
  parts.push(`Responsibilities variation ${variantIndex + 1}`);

  return parts.join("\n");
}

describe("easy apply extraction regression corpus", () => {
  const cases = baseCases.flatMap((baseCase) =>
    noiseBundles.map((noise, variantIndex) => ({
      id: `${baseCase.id}-v${variantIndex + 1}`,
      input: buildInput(baseCase, noise, variantIndex),
      expected: {
        roleTitle: baseCase.roleTitle,
        company: baseCase.company,
        location: baseCase.locationExpected,
        hasLocationIssue: baseCase.locationExpected.length === 0
      }
    }))
  );

  it("builds at least 40 fixed easy-apply samples", () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });

  for (const sample of cases) {
    it(`extracts expected fields for ${sample.id}`, () => {
      const result = extractJobFromText(sample.input);

      expect(result.fields.roleTitle).toBe(sample.expected.roleTitle);
      expect(result.fields.company).toBe(sample.expected.company);
      expect(result.fields.location).toBe(sample.expected.location);
      expect(
        result.issues.some((issue) => issue.field === "location")
      ).toBe(sample.expected.hasLocationIssue);
    });
  }
});
