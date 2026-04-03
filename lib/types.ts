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
export const jobStages = [
  "applied",
  "hr_reach_out",
  "oa",
  "first_round",
  "second_plus_round",
  "offer"
] as const;
export type JobStage = (typeof jobStages)[number];
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
