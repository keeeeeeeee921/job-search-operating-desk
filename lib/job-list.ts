import type {
  JobListItem,
  JobRecord,
  PaginatedJobListResult
} from "@/lib/types";
import { truncate } from "@/lib/utils";

export const JOB_DESCRIPTION_PREVIEW_LENGTH = 320;
export const JOB_LIST_PAGE_SIZE = 50;

export function toJobListItem(
  record: Pick<
    JobRecord,
    | "id"
    | "roleTitle"
    | "company"
    | "location"
    | "link"
    | "timestamp"
    | "sourceType"
    | "sourceConfidence"
    | "extractionStatus"
    | "jobDescription"
  >
): JobListItem {
  return {
    id: record.id,
    roleTitle: record.roleTitle,
    company: record.company,
    location: record.location,
    link: record.link,
    timestamp: record.timestamp,
    sourceType: record.sourceType,
    sourceConfidence: record.sourceConfidence,
    extractionStatus: record.extractionStatus,
    jobDescriptionPreview: truncate(
      record.jobDescription,
      JOB_DESCRIPTION_PREVIEW_LENGTH
    )
  };
}

export function normalizePageNumber(page: number | undefined) {
  if (!page || Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function buildPaginatedJobListResult(
  records: JobListItem[],
  page: number,
  pageSize: number,
  totalCount: number
): PaginatedJobListResult {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    records,
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages
  };
}
