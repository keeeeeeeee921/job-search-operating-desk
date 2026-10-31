export const requiredJobFields = [
  "roleTitle",
  "company",
  "location",
  "link",
  "jobDescription"
] as const;

export type JobField = (typeof requiredJobFields)[number];
export type InputMode = "link" | "text";
export type SourceType =
  | "linkedin"
  | "greenhouse"
  | "lever"
  | "workday"
  | "company"
  | "unknown";
export type SourceConfidence = "high" | "low" | "unknown";
export type ExtractionStatus = "confirmed" | "needs_review";
export type JobPool = "active" | "rejected";
export type JobStage =
  | "no_response"
  | "rejected"
  | "screening_oa"
  | "unpaid"
  | "round_1"
  | "round_2"
  | "round_3"
  | "round_4"
  | "round_5"
  | "offer";
export type ValidationIssueType = "missing" | "suspicious";
export type FieldOrigin = "confirmed" | "derived" | "manual" | "missing";
export type GoalKey = "apply" | "connect" | "follow";

export interface JobRecord {
  id: string;
  roleTitle: string;
  company: string;
  location: string;
  link: string;
  jobDescription: string;
  timestamp: string;
  pool: JobPool;
  stage: JobStage;
  searchCycleLabel: string | null;
  comments: string;
  applyCountedDateKey: string | null;
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
  extractionStatus: ExtractionStatus;
}

export interface JobListItem {
  id: string;
  roleTitle: string;
  company: string;
  location: string;
  link: string;
  timestamp: string;
  stage: JobStage;
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
  extractionStatus: ExtractionStatus;
  jobDescriptionPreview: string;
}

export interface PaginatedJobListResult {
  records: JobListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ValidationIssue {
  field: JobField;
  type: ValidationIssueType;
  message: string;
}

export interface ExtractionResult {
  normalizedUrl: string;
  inputMode: InputMode;
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
  confidenceScores?: Partial<Record<JobField, number>>;
  extractionStatus: ExtractionStatus;
  supported: boolean;
  unsupportedReason?: string;
  fields: Partial<Record<JobField, string>>;
  fieldOrigins: Partial<Record<JobField, FieldOrigin>>;
  candidateValues: Partial<Record<JobField, string[]>>;
  issues: ValidationIssue[];
  notes: string[];
}

export interface JobDraft {
  inputMode: InputMode;
  roleTitle: string;
  company: string;
  location: string;
  link: string;
  jobDescription: string;
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
  confidenceScores?: Partial<Record<JobField, number>>;
  extractionStatus: ExtractionStatus;
  fieldOrigins: Partial<Record<JobField, FieldOrigin>>;
  candidateValues: Partial<Record<JobField, string[]>>;
  issues: ValidationIssue[];
  unsupportedReason?: string;
}

export interface DuplicateCandidate {
  record: JobRecord;
  score: number;
  reasons: string[];
}

export interface GoalState {
  label: string;
  count: number;
  target: number;
}

export interface DailyGoalsState {
  dateKey: string;
  goals: Record<GoalKey, GoalState>;
}

export interface ToastMessage {
  id: string;
  title: string;
  tone: "success" | "warning" | "error";
}

export interface EmailMatch {
  record: JobRecord;
  score: number;
  reasons: string[];
}

/**
 * One job search. Records belong to the cycle whose startDate is the latest
 * one on or before the record's timestamp; the cycle with the latest
 * startDate is the current working set. Dates are YYYY-MM-DD keys in the
 * search-cycle time zone (see lib/search-cycle.ts).
 */
export interface SearchCycle {
  id: number;
  label: string;
  startDate: string;
  endDate: string | null;
  title: string;
  goals: string[];
  note: string;
  imageSrc: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SearchCycleInput = Omit<SearchCycle, "id" | "createdAt" | "updatedAt">;

export type SearchCyclePatch = Partial<SearchCycleInput>;

export interface SearchLogStageBucket {
  searchCycleLabel: string;
  pool: JobPool;
  stage: JobStage;
  count: number;
}

/** A company and the furthest stage any application there reached. */
export interface InterviewedCompany {
  company: string;
  stage: JobStage;
}

export interface SearchLogCycleAnalytics {
  label: string;
  total: number;
  buckets: SearchLogStageBucket[];
  interviewedCompanies: InterviewedCompany[];
}

export interface SearchLogAnalytics {
  cycles: SearchLogCycleAnalytics[];
}
