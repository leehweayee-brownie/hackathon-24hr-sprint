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
