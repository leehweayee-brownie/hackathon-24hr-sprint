import { DocType, DocumentStatus, PassportStatus, RuleCode, Severity, UserRole, VendorCheckStatus } from './enums';

/** Bounding box in page fractions (0..1), origin top-left. */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single value read from a document by the vision model. */
export interface ExtractedField {
  key: string;
  rawValue: string | null;
  confidence: number;
  page: number;
  bbox: BBox | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ClassificationResult {
  docType: DocType;
  confidence: number;
  reason?: string;
  usage?: TokenUsage;
}

export interface ExtractionResult {
  fields: ExtractedField[];
  usage?: TokenUsage;
}

/** Recorded model responses for a fixture document (fixtures/extractions/<file>.json). */
export interface ExtractionRecording {
  fileName: string;
  classification: ClassificationResult;
  fields: ExtractedField[];
}

export interface Finding {
  rule: RuleCode;
  severity: Severity;
  message: string;
  deduction: number;
  documentIds: string[];
  /** Extra structured context for the UI (e.g. the two names that differ). */
  meta?: Record<string, unknown>;
}

export type ScoreBand = 'green' | 'amber' | 'red';

export interface TrustScoreResult {
  score: number;
  band: ScoreBand;
  deductions: Finding[];
}

export type RuleWeights = Record<RuleCode, number>;

export interface OrganizationSettings {
  confidenceThreshold?: number;
  expiryWarningDays?: number;
  minLiabilityCoverage?: number;
  approverThreshold?: number;
  ruleWeights?: Partial<RuleWeights>;
}

/** Standard API envelope. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors: Array<{ field?: string; message: string }>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** User as returned to the client. */
export interface UserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  organizationType: 'SUPPLIER' | 'BUYER' | 'ADMIN';
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DocumentFieldView {
  id: string;
  key: string;
  label: string;
  rawValue: string | null;
  normalizedValue: string | null;
  correctedValue: string | null;
  value: string | null;
  confidence: number;
  page: number;
  bbox: BBox | null;
  confirmedBy: string | null;
  confirmedByName?: string | null;
  confirmedAt: string | null;
  needsConfirmation: boolean;
}

export interface DocumentView {
  id: string;
  supplierId: string;
  fileName: string;
  mimeType: string;
  size: number;
  pageCount: number;
  sha256: string;
  docType: DocType | null;
  docTypeLabel: string | null;
  classificationConfidence: number | null;
  status: DocumentStatus;
  progress: number;
  error: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  supersededById: string | null;
  duplicateOfId?: string | null;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  fields?: DocumentFieldView[];
}

export interface TimelineEntry {
  documentId: string;
  docType: DocType;
  docTypeLabel: string;
  fileName: string;
  issuedAt: string | null;
  expiresAt: string | null;
  daysToExpiry: number | null;
  state: 'valid' | 'expiring' | 'expired' | 'no_expiry';
}

export interface PassportView {
  id: string;
  supplierId: string;
  supplierName: string;
  registrationNo: string | null;
  trustScore: number;
  band: ScoreBand;
  status: PassportStatus;
  verifiedAt: string | null;
  updatedAt: string;
  findings: Finding[];
  documents: DocumentView[];
  timeline: TimelineEntry[];
  companyDetails: Record<string, string | null>;
}

export interface PassportShareView {
  id: string;
  passportId: string;
  url: string;
  token?: string;
  buyerId: string | null;
  buyerName?: string | null;
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdAt: string;
}

export interface VendorCheckView {
  id: string;
  buyerId: string;
  supplierId: string;
  supplierName: string;
  tenderTitle: string;
  contractValue: number;
  requiredDocTypes: DocType[];
  trustScore: number | null;
  band: ScoreBand | null;
  status: VendorCheckStatus;
  decidedBy: string | null;
  decidedByName?: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  requiresApprover: boolean;
  createdAt: string;
  updatedAt: string;
  findings?: Finding[];
  timeline?: TimelineEntry[];
  documents?: DocumentView[];
  lowConfidenceFields?: Array<DocumentFieldView & { documentId: string; docType: DocType | null }>;
  /** Post-job rating, once the buyer has rated an approved check. */
  rating?: VendorRatingView | null;
}

export interface VendorRatingView {
  score: number;
  comment: string | null;
  ratedByName: string | null;
  createdAt: string;
}

/* ---------------------------------------------------------------- Vendor Match */

/** Structured tender requirements. The AI drafts them from the brief; the buyer confirms or edits before matching. */
export interface TenderRequirements {
  title: string;
  /** Work category, e.g. "Building works". */
  scope: string;
  contractValue: number | null;
  location: string | null;
  /** ISO dates (YYYY-MM-DD). The contract period every document must cover. */
  startDate: string | null;
  endDate: string | null;
  /** Lowest CIDB grade allowed. Derived from the contract value when the brief does not say. */
  minCidbGrade: string | null;
  /** Minimum public liability cover in MYR. */
  minLiabilityCoverage: number | null;
  requiredDocTypes: DocType[];
  /** Other must-haves the rules engine does not check (shown, not filtered). */
  notes: string[];
}

export interface BriefParseResult {
  requirements: TenderRequirements;
  /** Who drafted the requirements: the configured AI provider, or the built-in parser when AI is unavailable. */
  source: 'ai' | 'parser';
  /** Short notes on what was assumed or derived, e.g. "Grade G6 derived from RM7,000,000". */
  assumptions: string[];
}

export type MatchFit = 'qualified' | 'conditional' | 'excluded';

export type MatchGapKind = 'grade_below' | 'missing_document' | 'expired' | 'expires_before_end' | 'cover_below_minimum' | 'identity_mismatch';

export interface MatchGap {
  kind: MatchGapKind;
  docType: DocType | null;
  message: string;
  /** True when the supplier can close it by sending a document (shows "Request document"). */
  requestable: boolean;
}

export interface VendorMatch {
  supplierId: string;
  supplierName: string;
  fit: MatchFit;
  /** One-line verdict, e.g. "G7, insurance valid for the whole contract, rated 4.6 from 3 past jobs." */
  summary: string;
  strengths: string[];
  gaps: MatchGap[];
  trustScore: number | null;
  cidbGrade: string | null;
  liabilityCover: number | null;
  rating: { average: number | null; count: number };
  pastJobs: number;
  location: string | null;
  /** Open vendor check this buyer already has with the supplier, if any. */
  openCheckId: string | null;
}

export interface MatchResult {
  requirements: TenderRequirements;
  matches: VendorMatch[];
  /** Number of suppliers with a passport that were considered. */
  poolSize: number;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/* Socket.IO payloads (namespace /intake) */
export interface DocumentStatusEvent {
  documentId: string;
  status: DocumentStatus;
  progress: number;
  error?: string | null;
}
export interface DocumentClassifiedEvent {
  documentId: string;
  docType: DocType;
  confidence: number;
}
export interface DocumentExtractedEvent {
  documentId: string;
  fields: DocumentFieldView[];
}
export interface FindingsUpdatedEvent {
  supplierId: string;
  findings: Finding[];
  trustScore: number;
  band: ScoreBand;
}
export interface SocketErrorEvent {
  code: string;
  message: string;
}

export const SOCKET_EVENTS = {
  documentStatus: 'document:status',
  documentClassified: 'document:classified',
  documentExtracted: 'document:extracted',
  findingsUpdated: 'findings:updated',
  error: 'error',
} as const;

export const SEVERITY_ORDER: Record<Severity, number> = {
  [Severity.CRITICAL]: 0,
  [Severity.WARNING]: 1,
  [Severity.INFO]: 2,
};
