import { describe, expect, it } from "vitest";
import {
  INTERVIEWED_COMPANIES_EVIDENCE,
  countStages,
  findInterviewedCompany,
  guessStageFromComments,
  matchesCompanyName,
  parseSetArgument,
  parseStageOverrides,
  planStageBackfill,
  stripAutoArchiveNote
} from "@/lib/stage-backfill";
import { buildAutoArchiveNote } from "@/lib/stale-archive";
import type { JobRecord } from "@/lib/types";

function buildRecord(id: string, overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id,
    roleTitle: `Role ${id}`,
    company: `Company ${id}`,
    location: "Remote",
    link: "",
    jobDescription: "",
    timestamp: "2025-11-01T12:00:00.000Z",
    pool: "active",
    stage: "no_response",
    searchCycleLabel: "Search 01",
    comments: "",
    applyCountedDateKey: null,
    sourceType: "unknown",
    sourceConfidence: "unknown",
    extractionStatus: "confirmed",
    ...overrides
  };
}

describe("guessStageFromComments", () => {
  it.each([
    ["prescreening", "screening_oa"],
    ["screening - 不sponsorship", "screening_oa"],
    ["take-home test", "screening_oa"],
    ["hr interview", "screening_oa"],
    ["AI interview", "screening_oa"],
    ["过了一轮筛 hr reach out", "screening_oa"],
    ["This is the first step in the interview process", "screening_oa"],
    ["OA sent, hackerrank due Friday", "screening_oa"],
    ["笔试通过", "screening_oa"],
    ["11.13一面", "round_1"],
    ["2.6 first round 只要在校生", "round_1"],
    ["interview scheduled next week", "round_1"],
    ["面试安排在周三", "round_1"],
    ["下一面和hm", "round_2"],
    ["hr hm: moved to hiring manager", "round_2"],
    ["二面后没消息", "round_2"],
    ["final round onsite", "round_3"],
    ["case study presentation", "round_3"],
    ["三面", "round_3"],
    ["offer letter received", "offer"],
    ["拿到offer", "offer"]
  ])("maps %j to %s", (comments, stage) => {
    expect(guessStageFromComments(comments)?.stage).toBe(stage);
  });

  it("takes the highest stage when several keywords hit and keeps them as evidence", () => {
    const guess = guessStageFromComments("prescreening done, 11.13一面, 下一面和hm");
    expect(guess?.stage).toBe("round_2");
    expect(guess?.evidence).toEqual(
      expect.arrayContaining(["prescreen", "一面", "下一面", "hm"])
    );
    expect(["下一面", "hm"]).toContain(guess?.evidence[0]);
    expect(guess?.evidence.at(-1)).toBe("prescreen");
  });

  it("does not count 'no offer' / 'not offer' / 没有offer as an offer", () => {
    expect(guessStageFromComments("final round, no offer")?.stage).toBe("round_3");
    expect(guessStageFromComments("did not offer")).toBeNull();
    expect(guessStageFromComments("二面后没有offer")?.stage).toBe("round_2");
  });

  it("does not read '下一面' as a Round 1 '一面'", () => {
    const guess = guessStageFromComments("下一面");
    expect(guess?.stage).toBe("round_2");
    expect(guess?.evidence).not.toContain("一面");
  });

  it("does not promote screening phrases that contain 'interview' to Round 1", () => {
    expect(guessStageFromComments("hr interview on Monday")?.stage).toBe("screening_oa");
    expect(guessStageFromComments("AI interview link")?.stage).toBe("screening_oa");
    expect(guessStageFromComments("phone interview")?.stage).toBe("screening_oa");
  });

  it("does not read '拿到面试' as an offer", () => {
    expect(guessStageFromComments("拿到面试")?.stage).toBe("round_1");
  });

  it("ignores 'finally' and 'Saxon'-style partial words", () => {
    expect(guessStageFromComments("finally rejected")).toBeNull();
  });

  it("does not read screening questionnaires or 'final decision' as interview rounds", () => {
    expect(guessStageFromComments("You have been selected to take a pre-interview questionnaire")?.stage).toBe("screening_oa");
    expect(guessStageFromComments("pre-screening Sales Analytics Interview Questionnaire")?.stage).toBe("screening_oa");
    expect(guessStageFromComments("we will make a final decision next week")).toBeNull();
  });

  it("does not read a bare 'offer' inside long notes as an offer", () => {
    expect(guessStageFromComments("2.20面试 the role will offer exposure to BI dashboards")?.stage).toBe("round_1");
    expect(guessStageFromComments("I wanted to reach out directly to offer a conversation")).toBeNull();
    expect(guessStageFromComments("offer")?.stage).toBe("offer");
    expect(guessStageFromComments("got the offer!")?.stage).toBe("offer");
  });

  it("returns null for empty, whitespace-only or keyword-free comments", () => {
    expect(guessStageFromComments("")).toBeNull();
    expect(guessStageFromComments("   ")).toBeNull();
    expect(guessStageFromComments("applied via referral")).toBeNull();
  });

  it("ignores the Auto-archived system note", () => {
    const note = buildAutoArchiveNote("2025-09-06T12:00:00.000Z");
    expect(stripAutoArchiveNote(note)).toBe("");
    expect(guessStageFromComments(note)).toBeNull();
    expect(guessStageFromComments(`hr hm: next steps\n${note}`)?.stage).toBe("round_2");
  });
});

describe("company list matching", () => {
  it.each([
    ["Jerry", "Jerry.ai"],
    ["Jerry.ai", "Jerry.ai"],
    ["Tencent America", "Tencent"],
    ["NYC Tourism", "NYC Tourism + Conventions"],
    ["NYC Tourism and Conventions", "NYC Tourism + Conventions"],
    ["L'Oreal USA", "L'Oréal"],
    ["l'oréal", "L'Oréal"],
    ["IBM", "IBM Canada"],
    ["ZURU", "ZURU Toys"],
    ["fedex dataworks", "FedEx"],
    ["CARMAX", "CarMax"]
  ])("%j matches %j", (recordCompany, listed) => {
    expect(matchesCompanyName(recordCompany, listed)).toBe(true);
  });

  it.each([
    ["Saxon Bank", "Axon"],
    ["Amazon", "Axon"],
    ["A", "Axon"],
    ["Corsairs Logistics", "Corsair"],
    ["", "FedEx"]
  ])("%j does not match %j", (recordCompany, listed) => {
    expect(matchesCompanyName(recordCompany, listed)).toBe(false);
  });

  it("finds the listed company for a record from the Search 01 list", () => {
    expect(findInterviewedCompany("Tencent America")).toBe("Tencent");
    expect(findInterviewedCompany("Walmart")).toBeNull();
  });
});

describe("planStageBackfill", () => {
  const list = ["Axon", "ZURU Toys"];

  it("only touches records still at no_response / rejected with a human comment", () => {
    const records = [
      buildRecord("a1", { comments: "prescreening" }),
      buildRecord("a2", { comments: "11.13一面", pool: "rejected", stage: "rejected" }),
      buildRecord("a3", { comments: "11.13一面", stage: "round_2" }),
      buildRecord("a4", { comments: "" }),
      buildRecord("a5", {
        comments: buildAutoArchiveNote("2025-09-06T12:00:00.000Z"),
        pool: "rejected",
        stage: "rejected"
      }),
      buildRecord("a6", { comments: "applied via referral" })
    ];

    const plan = planStageBackfill(records, {}, list);
    expect(plan.rows.map((row) => [row.record.id, row.suggestedStage, row.source])).toEqual([
      ["a1", "screening_oa", "keywords"],
      ["a2", "round_1", "keywords"]
    ]);
    expect(plan.rows.every((row) => row.changed)).toBe(true);
  });

  it("suggests Round 1 for Search 01 records of listed companies only when a human note exists", () => {
    const records = [
      buildRecord("c1", { company: "Axon", comments: "10.21电话" }),
      buildRecord("c2", {
        company: "Axon Enterprise",
        comments: buildAutoArchiveNote("2025-09-06T12:00:00.000Z"),
        pool: "rejected",
        stage: "rejected"
      }),
      buildRecord("c3", { company: "Axon", searchCycleLabel: "Search 02", comments: "note" }),
      buildRecord("c4", { company: "Axon", comments: "hr hm: ..." }),
      buildRecord("c5", { company: "ZURU", stage: "offer" }),
      buildRecord("c6", { company: "Axon" })
    ];

    const plan = planStageBackfill(records, {}, list);
    const byId = new Map(plan.rows.map((row) => [row.record.id, row]));

    expect(byId.get("c1")?.suggestedStage).toBe("round_1");
    expect(byId.get("c1")?.evidence).toEqual([INTERVIEWED_COMPANIES_EVIDENCE]);
    expect(byId.get("c1")?.source).toBe("company-list");
    // auto-archived note only: never interviewed, so the list does not apply
    expect(byId.has("c2")).toBe(false);
    expect(byId.has("c3")).toBe(false);
    expect(byId.get("c4")?.suggestedStage).toBe("round_2");
    expect(byId.get("c4")?.evidence).toEqual(["hm", INTERVIEWED_COMPANIES_EVIDENCE]);
    expect(byId.has("c5")).toBe(false);
    // no comment at all: one of many applications to that company, not the interview
    expect(byId.has("c6")).toBe(false);
  });

  it("resolves the Search 01 label from the timestamp when the label is null", () => {
    const records = [
      buildRecord("t1", { company: "Axon", comments: "note", searchCycleLabel: null, timestamp: "2025-12-01T12:00:00.000Z" }),
      buildRecord("t2", { company: "Axon", comments: "note", searchCycleLabel: null, timestamp: "2026-06-01T12:00:00.000Z" })
    ];
    const ids = planStageBackfill(records, {}, list).rows.map((row) => row.record.id);
    expect(ids).toEqual(["t1"]);
  });

  it("lets overrides win over keywords and the company list, by id or id prefix", () => {
    const records = [
      buildRecord("abcdef12-0000", { company: "ZURU Toys", comments: "hr hm: ..." }),
      buildRecord("abcdef99-0000", { comments: "prescreening" }),
      buildRecord("zz-already-staged", { comments: "", stage: "round_1" }),
      buildRecord("keep-me", { comments: "offer" })
    ];

    const plan = planStageBackfill(
      records,
      {
        abcdef12: "offer",
        "zz-already-staged": "round_3",
        "keep-me": "skip"
      },
      list
    );
    const byId = new Map(plan.rows.map((row) => [row.record.id, row]));

    expect(byId.get("abcdef12-0000")?.suggestedStage).toBe("offer");
    expect(byId.get("abcdef12-0000")?.source).toBe("override");
    expect(byId.get("abcdef99-0000")?.suggestedStage).toBe("screening_oa");
    expect(byId.get("zz-already-staged")?.suggestedStage).toBe("round_3");
    expect(byId.get("zz-already-staged")?.changed).toBe(true);
    expect(byId.get("keep-me")?.suggestedStage).toBeNull();
    expect(byId.get("keep-me")?.changed).toBe(false);
  });

  it("reports unmatched and ambiguous overrides instead of guessing", () => {
    const records = [buildRecord("abc-1"), buildRecord("abc-2")];
    const plan = planStageBackfill(records, { abc: "offer", nope: "round_1" }, list);

    expect(plan.rows).toEqual([]);
    expect(plan.unmatchedOverrides).toEqual(["nope"]);
    expect(plan.ambiguousOverrides).toEqual([{ key: "abc", ids: ["abc-1", "abc-2"] }]);
  });

  it("marks an override equal to the current stage as no change", () => {
    const records = [buildRecord("same", { stage: "round_2" })];
    const plan = planStageBackfill(records, { same: "round_2" }, list);
    expect(plan.rows[0]?.changed).toBe(false);
  });

  it("counts suggested stages in stage order", () => {
    const records = [
      buildRecord("k1", { comments: "offer" }),
      buildRecord("k2", { comments: "prescreening" }),
      buildRecord("k3", { comments: "screening" })
    ];
    expect(countStages(planStageBackfill(records, {}, list).rows)).toEqual([
      { stage: "screening_oa", count: 2 },
      { stage: "offer", count: 1 }
    ]);
  });
});

describe("override parsing", () => {
  it("accepts stages and skip, ignores _comment keys, rejects unknown stages", () => {
    expect(
      parseStageOverrides({ _comment: "ignored", abc: "offer", def: "skip" }, "file")
    ).toEqual({ abc: "offer", def: "skip" });
    expect(() => parseStageOverrides({ abc: "round_9" }, "file")).toThrow(/invalid stage/);
    expect(() => parseStageOverrides([], "file")).toThrow(/expected a JSON object/);
  });

  it("parses --set <id>=<stage>", () => {
    expect(parseSetArgument("abcdef12=round_3")).toEqual({ abcdef12: "round_3" });
    expect(() => parseSetArgument("abcdef12")).toThrow(/--set expects/);
    expect(() => parseSetArgument("abcdef12=nope")).toThrow(/invalid stage/);
  });
});
