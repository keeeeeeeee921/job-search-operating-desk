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
  comments: string;
  applyCountedDateKey: string | null;
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
  extractionStatus: ExtractionStatus;
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
