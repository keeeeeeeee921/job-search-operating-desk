import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobRecordRow } from "@/components/job-record-row";
import type { JobListItem } from "@/lib/types";

const record: JobListItem = {
  id: "row-1",
  roleTitle: "AI Business Analyst Intern",
  company: "Tencent",
  location: "United States (Remote)",
  link: "https://tencent.wd1.myworkdayjobs.com/en-US/Tencent_Careers/job/US-California-Los-Angeles/AI-Business-Analyst-Intern_R107098?locations=b3d4dad114e4100177c032bef7130000",
  timestamp: "2026-03-29T01:31:39.062Z",
  stage: "no_response",
  sourceType: "workday",
  sourceConfidence: "high",
  extractionStatus: "confirmed",
  jobDescriptionPreview:
    "Tencent Games was established in 2003 and continues to expand its global analytics and strategy capabilities."
};

describe("JobRecordRow", () => {
  it("uses a concise accessible action while preserving the full posting href", () => {
    render(<JobRecordRow record={record} />);

    const link = screen.getByRole("link", {
      name: `Open posting for ${record.roleTitle}`
    });
    expect(link).toHaveAttribute("href", record.link);
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByText(record.link)).not.toBeInTheDocument();
    expect(
      screen.getByText(`${record.company} · ${record.location}`)
    ).toBeInTheDocument();
    expect(screen.queryByText("Workday")).not.toBeInTheDocument();
    expect(screen.getByText("No Response")).toBeInTheDocument();
  });
});
