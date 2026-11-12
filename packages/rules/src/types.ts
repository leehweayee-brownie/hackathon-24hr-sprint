import type { DocType, DocumentStatus, RuleWeights } from '@vp/shared';

/** A normalized field value as the rules engine sees it. */
export interface RuleField {
  /** Effective value: corrected value if any, else the normalized value. */
  value: string | null;
  confidence: number;
  confirmed: boolean;
}

export interface RuleDocument {
  id: string;
  docType: DocType;
  status: DocumentStatus;
  fileName: string;
  issuedAt: string | null;
  expiresAt: string | null;
  supersededById: string | null;
  fields: Record<string, RuleField>;
}

export interface RuleContext {
  documents: RuleDocument[];
  /** Reference time. Defaults to now. */
  now?: Date;
  /** Tender/contract value in MYR. When absent, the CIDB grade rule is skipped. */
  contractValue?: number | null;
  /** Document types a buyer requires. Defaults to DEFAULT_REQUIRED_DOC_TYPES. */
  requiredDocTypes?: DocType[] | null;
  /** Buyer's minimum public liability cover in MYR. When absent, the coverage rule is skipped. */
  minLiabilityCoverage?: number | null;
  weights?: Partial<RuleWeights> | null;
  confidenceThreshold?: number | null;
  expiryWarningDays?: number | null;
}

export interface ResolvedRuleContext {
  documents: RuleDocument[];
  activeDocuments: RuleDocument[];
  now: Date;
  contractValue: number | null;
  requiredDocTypes: DocType[];
  minLiabilityCoverage: number | null;
  weights: RuleWeights;
  confidenceThreshold: number;
  expiryWarningDays: number;
}
