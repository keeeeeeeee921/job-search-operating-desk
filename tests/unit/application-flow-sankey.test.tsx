import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicationFlowSankey } from "@/components/application-flow-sankey";
import type { ApplicationFlowSankeyData } from "@/lib/types";

const data: ApplicationFlowSankeyData = {
  totalRecords: 3,
  activeCount: 2,
  rejectedCount: 1,
  links: [
    { stage: "applied", pool: "active", count: 1 },
    { stage: "oa", pool: "active", count: 1 },
    { stage: "oa", pool: "rejected", count: 1 }
  ],
  records: [
    {
      id: "active-applied",
      roleTitle: "Applied Analyst",
      company: "Alpha Co",
      location: "Remote",
      timestamp: "2026-03-10T12:00:00.000Z",
      pool: "active",
      stage: "applied",
      commentsPreview: "",
      hasComments: false
    },
    {
      id: "active-oa",
      roleTitle: "Assessment Analyst",
      company: "Beta Co",
      location: "Boston, Massachusetts, United States",
      timestamp: "2026-03-11T12:00:00.000Z",
      pool: "active",
      stage: "oa",
      commentsPreview: "Completed OA and moved forward.",
      hasComments: true
    },
    {
      id: "rejected-oa",
      roleTitle: "Rejected After OA",
      company: "Gamma Co",
      location: "New York, New York, United States",
      timestamp: "2026-03-12T12:00:00.000Z",
      pool: "rejected",
      stage: "oa",
      commentsPreview: "Reviewed after OA and rejected.",
      hasComments: true
    }
  ]
};

describe("ApplicationFlowSankey", () => {
  it("shows branch-specific records in the details panel", () => {
    render(<ApplicationFlowSankey data={data} />);

    expect(screen.queryByRole("button", { name: "Applied -> OA" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Applied -> Active" })).not.toBeInTheDocument();
    expect(screen.queryByText("Branch Records")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "OA -> Rejected" }));

    expect(screen.getByText("Branch Records")).toBeInTheDocument();
    expect(screen.getByText("OA -> Rejected")).toBeInTheDocument();
    expect(screen.getByText("Rejected After OA")).toBeInTheDocument();
    expect(screen.getByText("Gamma Co")).toBeInTheDocument();
    expect(screen.queryByText("Assessment Analyst")).not.toBeInTheDocument();
  });
});
