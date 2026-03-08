import { describe, expect, it } from "vitest";
import {
  buildHistoricalIdentityKey,
  buildHistoricalRecord,
  cleanCompanyCell,
  isBlankHistoricalRow,
  isImportableHistoricalDraft,
  mapHistoricalRowToDraft,
  mergeComments,
  spreadHistoricalTimestamps
} from "@/lib/historical-import";
import type { JobRecord } from "@/lib/types";

describe("historical import helpers", () => {
  it("maps workbook rows into curated import drafts", () => {
    const draft = mapHistoricalRowToDraft({
      sheetName: "进行中",
      pool: "active",
      rowNumber: 2,
      row: {
        岗位: "Data Analyst",
        链接: "https://jobs.lever.co/example/123?utm_source=linkedin",
        "公司-项目": "Example Corp",
        地点: "New York, NY",
        JD: "Analyze reporting\nand build dashboards.",
        进度: "Phone screen complete",
        "进度 2": "Onsite pending"
      }
    });

    expect(draft.roleTitle).toBe("Data Analyst");
    expect(draft.link).toBe("https://jobs.lever.co/example/123");
    expect(draft.company).toBe("Example Corp");
    expect(draft.location).toBe("New York, NY");
    expect(draft.jobDescription).toBe("Analyze reporting and build dashboards.");
    expect(draft.comments).toBe("Phone screen complete\nOnsite pending");
  });

  it("removes logo noise from company cells", () => {
    expect(cleanCompanyCell("Mastercard logo\nMastercard")).toBe("Mastercard");
  });

  it("skips completely blank rows", () => {
    expect(isBlankHistoricalRow({})).toBe(true);
    expect(
      isBlankHistoricalRow({
        岗位: "  ",
        链接: "",
        "公司-项目": "",
        地点: "",
        JD: ""
      })
    ).toBe(true);
  });

  it("marks rows missing required non-link fields as invalid", () => {
    const draft = mapHistoricalRowToDraft({
      sheetName: "进行中",
      pool: "active",
      rowNumber: 8,
      row: {
        岗位: "Business Analyst",
        链接: "",
        "公司-项目": "",
        地点: "Remote",
        JD: "Support reporting."
      }
    });

    expect(isImportableHistoricalDraft(draft)).toBe(false);
  });

  it("spreads timestamps deterministically across the requested range", () => {
    const timestamps = spreadHistoricalTimestamps({
      count: 3,
      start: "2025-09-16",
      end: "2026-03-07"
    });

    expect(timestamps).toHaveLength(3);
    expect(timestamps[0]).toBe("2025-09-16T00:00:00.000Z");
    expect(timestamps[2]).toBe("2026-03-07T23:59:59.000Z");
    expect(new Date(timestamps[1]).getTime()).toBeGreaterThan(
      new Date(timestamps[0]).getTime()
    );
  });

  it("uses links as the preferred dedupe identity key", () => {
    const recordA: JobRecord = {
      id: "a",
      roleTitle: "Analyst",
      company: "Example",
      location: "Remote",
      link: "https://jobs.lever.co/example/123?utm_source=linkedin",
      jobDescription: "Support reporting",
      timestamp: "2026-01-01T00:00:00.000Z",
      pool: "active",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "lever",
      sourceConfidence: "high",
      extractionStatus: "confirmed"
    };
    const recordB = { ...recordA, id: "b", link: "https://jobs.lever.co/example/123" };

    expect(buildHistoricalIdentityKey(recordA)).toBe(buildHistoricalIdentityKey(recordB));
  });

  it("falls back to role + company + pool when links are empty", () => {
    const activeKey = buildHistoricalIdentityKey({
      roleTitle: "Business Analyst",
      company: "Example Co",
      link: "",
      pool: "active"
    });
    const rejectedKey = buildHistoricalIdentityKey({
      roleTitle: "Business Analyst",
      company: "Example Co",
      link: "",
      pool: "rejected"
    });

    expect(activeKey).not.toBe(rejectedKey);
  });

  it("preserves curated import metadata on built records", () => {
    const record = buildHistoricalRecord(
      {
        sheetName: "已结束",
        pool: "rejected",
        rowNumber: 16,
        roleTitle: "Data Scientist",
        link: "",
        company: "Curated Co",
        location: "Toronto, ON",
        jobDescription: "Build models and reporting.",
        comments: mergeComments("Rejected", "Keep for future")
      },
      "2025-12-01T12:00:00.000Z"
    );

    expect(record.pool).toBe("rejected");
    expect(record.extractionStatus).toBe("confirmed");
    expect(record.sourceConfidence).toBe("high");
    expect(record.sourceType).toBe("unknown");
    expect(record.comments).toBe("Rejected\nKeep for future");
  });
});
