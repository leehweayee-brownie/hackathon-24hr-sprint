import { DOC_TYPE_DEFINITIONS, TimelineEntry, docTypeLabel } from '@vp/shared';
import { daysUntil } from './dates';
import type { RuleDocument } from './types';

/** Builds the expiry timeline for a vendor's active documents. */
export function buildTimeline(documents: RuleDocument[], now: Date = new Date(), warningDays = 30): TimelineEntry[] {
  return documents
    .filter((d) => !d.supersededById)
    .map((d) => {
      const expiresAt = d.expiresAt ?? d.fields.expiry_date?.value ?? null;
      const issuedAt = d.issuedAt ?? d.fields.issue_date?.value ?? null;
      const days = daysUntil(expiresAt, now);
      let state: TimelineEntry['state'] = 'no_expiry';
      if (DOC_TYPE_DEFINITIONS[d.docType]?.hasExpiry && days !== null) {
        state = days < 0 ? 'expired' : days <= warningDays ? 'expiring' : 'valid';
      }
      return {
        documentId: d.id,
        docType: d.docType,
        docTypeLabel: docTypeLabel(d.docType),
        fileName: d.fileName,
        issuedAt,
        expiresAt,
        daysToExpiry: days,
        state,
      };
    })
    .sort((a, b) => {
      if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
      if (a.expiresAt) return -1;
      if (b.expiresAt) return 1;
      return a.docType.localeCompare(b.docType);
    });
}
