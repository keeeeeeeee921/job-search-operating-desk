import { describe, expect, it } from "vitest";
import { formatJobStageLabel, inferStageFromComments } from "@/lib/job-stage";

describe("job stage helpers", () => {
  it("defaults to applied when comments are empty or do not match", () => {
    expect(inferStageFromComments("")).toBe("applied");
    expect(inferStageFromComments("Sent thank-you note and waiting.")).toBe(
      "applied"
    );
  });

  it("infers recruiter reach-out before interview milestones", () => {
    expect(inferStageFromComments("Recruiter reached out for a screening call.")).toBe(
      "hr_reach_out"
    );
  });

  it("infers online assessments", () => {
    expect(inferStageFromComments("Completed OA and Hackerrank yesterday.")).toBe(
      "oa"
    );
  });

  it("infers first-round interviews", () => {
    expect(
      inferStageFromComments("Phone screen complete. Hiring manager interview scheduled.")
    ).toBe("first_round");
  });

  it("infers later-stage interviews ahead of earlier matches", () => {
    expect(
      inferStageFromComments("Recruiter reached out, then final round onsite confirmed.")
    ).toBe("second_plus_round");
  });

  it("treats offer language as the furthest stage", () => {
    expect(
      inferStageFromComments("Received verbal offer after final round panel.")
    ).toBe("offer");
  });

  it("formats stage labels for UI display", () => {
    expect(formatJobStageLabel("hr_reach_out")).toBe("HR reach-out");
    expect(formatJobStageLabel("second_plus_round")).toBe("2nd round+ interview");
  });
});
