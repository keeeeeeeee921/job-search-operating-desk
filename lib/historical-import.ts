import { createHash } from "node:crypto";
import { detectSource } from "@/lib/sourceDetection";
import type {
  JobPool,
  JobRecord,
  SourceConfidence,
  SourceType
} from "@/lib/types";
import { normalizeText, normalizeUrl } from "@/lib/utils";

export const historicalImportSheets = [
  { name: "进行中", pool: "active" },
  { name: "已结束", pool: "rejected" },
  { name: "进行中-加拿大", pool: "active" },
  { name: "已结束-加拿大", pool: "rejected" }
] as const satisfies Array<{ name: string; pool: JobPool }>;

export type HistoricalImportSheetName = (typeof historicalImportSheets)[number]["name"];

export type HistoricalWorkbookInputRow = {
  岗位?: string;
  链接?: string;
  "公司-项目"?: string;
  地点?: string;
  投递日期?: string;
  JD?: string;
  进度?: string;
  "进度 2"?: string;
};

export interface HistoricalImportDraft {
  sheetName: HistoricalImportSheetName;
  pool: JobPool;
  rowNumber: number;
  roleTitle: string;
  link: string;
  company: string;
  location: string;
  jobDescription: string;
  comments: string;
}

export interface HistoricalImportStats {
  sheetName: HistoricalImportSheetName;
  pool: JobPool;
  totalRows: number;
  skippedBlankRows: number;
  skippedInvalidRows: number;
  importableRows: number;
  skippedDuplicates: number;
  inserted: number;
}

export function collapseImportText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

export function cleanCompanyCell(value: unknown) {
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/logo$/i.test(line));

  if (lines.length === 0) {
    return "";
  }

  return Array.from(new Set(lines)).join(" ");
}

export function mergeComments(primary: unknown, secondary: unknown) {
  const parts = [collapseImportText(primary), collapseImportText(secondary)].filter(Boolean);
  return Array.from(new Set(parts)).join("\n");
}

export function isBlankHistoricalRow(row: HistoricalWorkbookInputRow) {
  return [
    row["岗位"],
    row["链接"],
    row["公司-项目"],
    row["地点"],
    row["JD"],
    row["进度"],
    row["进度 2"]
  ].every((value) => !collapseImportText(value));
}

export function mapHistoricalRowToDraft(input: {
  row: HistoricalWorkbookInputRow;
  rowNumber: number;
  sheetName: HistoricalImportSheetName;
  pool: JobPool;
}) {
  const roleTitle = collapseImportText(input.row["岗位"]);
  const rawLink = collapseImportText(input.row["链接"]);
  const link = rawLink ? normalizeUrl(rawLink) ?? rawLink : "";
  const company = cleanCompanyCell(input.row["公司-项目"]);
  const location = collapseImportText(input.row["地点"]);
  const jobDescription = collapseImportText(input.row["JD"]);
  const comments = mergeComments(input.row["进度"], input.row["进度 2"]);

  return {
    sheetName: input.sheetName,
    pool: input.pool,
    rowNumber: input.rowNumber,
    roleTitle,
    link,
    company,
    location,
    jobDescription,
    comments
  } satisfies HistoricalImportDraft;
}

export function isImportableHistoricalDraft(draft: HistoricalImportDraft) {
  return Boolean(
    draft.roleTitle &&
      draft.company &&
      draft.location &&
      draft.jobDescription
  );
}

export function spreadHistoricalTimestamps(options: {
  count: number;
  start: string;
  end: string;
}) {
  if (options.count <= 0) {
    return [];
  }

  const startTime = new Date(`${options.start}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${options.end}T23:59:59.000Z`).getTime();

  if (options.count === 1) {
    return [new Date(startTime).toISOString()];
  }

  const span = endTime - startTime;
  return Array.from({ length: options.count }, (_, index) => {
    const ratio = index / (options.count - 1);
    return new Date(startTime + Math.round(span * ratio)).toISOString();
  });
}

export function buildHistoricalRecord(
  draft: HistoricalImportDraft,
  timestamp: string
): JobRecord {
  const source: {
    sourceType: SourceType;
    sourceConfidence: SourceConfidence;
  } = draft.link
    ? detectSource(draft.link)
    : {
        sourceType: "unknown",
        sourceConfidence: "high"
      };

  return {
    id: createHash("sha256")
      .update(`historical:${draft.sheetName}:${draft.rowNumber}:${draft.pool}`)
      .digest("hex")
      .slice(0, 24),
    roleTitle: draft.roleTitle,
    company: draft.company,
    location: draft.location,
    link: draft.link,
    jobDescription: draft.jobDescription,
    timestamp,
    pool: draft.pool,
    comments: draft.comments,
    applyCountedDateKey: null,
    sourceType: source.sourceType,
    sourceConfidence: "high",
    extractionStatus: "confirmed"
  };
}

export function buildHistoricalIdentityKey(record: Pick<
  JobRecord,
  "roleTitle" | "company" | "link" | "pool"
>) {
  if (record.link) {
    const normalized = normalizeUrl(record.link) ?? record.link.trim();
    return `link:${normalized.toLowerCase()}`;
  }

  return `fallback:${record.pool}:${normalizeText(record.roleTitle)}:${normalizeText(
    record.company
  )}`;
}
