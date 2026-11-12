import { RuleCode } from './enums';
import type { RuleWeights } from './types';

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;
export const DEFAULT_EXPIRY_WARNING_DAYS = 30;
export const DEFAULT_MIN_LIABILITY_COVERAGE = 1_000_000;
export const DEFAULT_APPROVER_THRESHOLD = 5_000_000;
export const REMINDER_DAYS = [60, 30, 7] as const;

export const DEFAULT_RULE_WEIGHTS: RuleWeights = {
  [RuleCode.DOCUMENT_EXPIRED]: 30,
  [RuleCode.REGISTRATION_NO_MISMATCH]: 25,
  [RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE]: 25,
  [RuleCode.COMPANY_NAME_MISMATCH]: 20,
  [RuleCode.REQUIRED_DOCUMENT_MISSING]: 15,
  [RuleCode.DOCUMENT_EXPIRING_SOON]: 10,
  [RuleCode.COVERAGE_BELOW_MINIMUM]: 10,
  [RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD]: 5,
};

export const RULE_LABELS: Record<RuleCode, string> = {
  [RuleCode.DOCUMENT_EXPIRED]: 'Required document expired',
  [RuleCode.REGISTRATION_NO_MISMATCH]: 'Registration number mismatch',
  [RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE]: 'CIDB grade below contract value',
  [RuleCode.COMPANY_NAME_MISMATCH]: 'Company name mismatch',
  [RuleCode.REQUIRED_DOCUMENT_MISSING]: 'Required document missing',
  [RuleCode.DOCUMENT_EXPIRING_SOON]: 'Document expiring within 30 days',
  [RuleCode.COVERAGE_BELOW_MINIMUM]: 'Coverage below buyer minimum',
  [RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD]: 'Unconfirmed low-confidence field',
};

export const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'] as const;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_PAGES = 20;
export const MAX_FILES_PER_UPLOAD = 30;

export const SCORE_BANDS = { green: 80, amber: 60 } as const;

export function scoreBand(score: number): 'green' | 'amber' | 'red' {
  if (score >= SCORE_BANDS.green) return 'green';
  if (score >= SCORE_BANDS.amber) return 'amber';
  return 'red';
}
