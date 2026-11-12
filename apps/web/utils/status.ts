import { DocumentStatus, Severity, VendorCheckStatus, type ScoreBand } from '@vp/shared';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const DOCUMENT_STATUS_META: Record<DocumentStatus, { label: string; tone: Tone; step: number }> = {
  [DocumentStatus.UPLOADED]: { label: 'Uploaded', tone: 'neutral', step: 1 },
  [DocumentStatus.CONVERTING]: { label: 'Converting pages', tone: 'info', step: 2 },
  [DocumentStatus.CLASSIFYING]: { label: 'Classifying', tone: 'info', step: 3 },
  [DocumentStatus.EXTRACTING]: { label: 'Reading fields', tone: 'info', step: 4 },
  [DocumentStatus.NEEDS_REVIEW]: { label: 'Needs review', tone: 'warning', step: 5 },
  [DocumentStatus.VERIFIED]: { label: 'Verified', tone: 'success', step: 6 },
  [DocumentStatus.FAILED]: { label: 'Failed', tone: 'danger', step: 0 },
};

export const PROCESSING_STATUSES: DocumentStatus[] = [
  DocumentStatus.UPLOADED,
  DocumentStatus.CONVERTING,
  DocumentStatus.CLASSIFYING,
  DocumentStatus.EXTRACTING,
];

export function isProcessing(status: DocumentStatus): boolean {
  return PROCESSING_STATUSES.includes(status);
}

export const CHECK_STATUS_META: Record<VendorCheckStatus, { label: string; tone: Tone }> = {
  [VendorCheckStatus.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [VendorCheckStatus.IN_REVIEW]: { label: 'In review', tone: 'info' },
  [VendorCheckStatus.MORE_INFO]: { label: 'More documents requested', tone: 'warning' },
  [VendorCheckStatus.APPROVED]: { label: 'Approved', tone: 'success' },
  [VendorCheckStatus.REJECTED]: { label: 'Rejected', tone: 'danger' },
};

export const SEVERITY_META: Record<Severity, { label: string; tone: Tone }> = {
  [Severity.CRITICAL]: { label: 'Critical', tone: 'danger' },
  [Severity.WARNING]: { label: 'Warning', tone: 'warning' },
  [Severity.INFO]: { label: 'Info', tone: 'info' },
};

export function bandTone(band: ScoreBand | null | undefined): Tone {
  if (band === 'green') return 'success';
  if (band === 'amber') return 'warning';
  if (band === 'red') return 'danger';
  return 'neutral';
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  green: 'Trusted',
  amber: 'Review needed',
  red: 'High risk',
};

export function confidenceTone(confidence: number, threshold = 0.85): Tone {
  if (confidence >= threshold) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'danger';
}
