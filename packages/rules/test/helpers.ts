import { DocType, DocumentStatus } from '@vp/shared';
import type { RuleDocument, RuleField } from '../src';

let counter = 0;

export function field(value: string | null, confidence = 0.95, confirmed = false): RuleField {
  return { value, confidence, confirmed };
}

export function doc(
  docType: DocType,
  fields: Record<string, string | null | RuleField>,
  overrides: Partial<RuleDocument> = {},
): RuleDocument {
  counter += 1;
  const normalizedFields: Record<string, RuleField> = {};
  for (const [k, v] of Object.entries(fields)) {
    normalizedFields[k] = typeof v === 'string' || v === null ? field(v) : v;
  }
  return {
    id: `doc-${counter}`,
    docType,
    status: DocumentStatus.VERIFIED,
    fileName: `${docType.toLowerCase()}.pdf`,
    issuedAt: normalizedFields.issue_date?.value ?? null,
    expiresAt: normalizedFields.expiry_date?.value ?? null,
    supersededById: null,
    fields: normalizedFields,
    ...overrides,
  };
}

export const NOW = new Date('2026-11-12T00:00:00Z');

export function binaJayaDocs(opts: { insuranceName?: string; grade?: string; insuranceExpiry?: string } = {}): RuleDocument[] {
  return [
    doc(DocType.SSM, { company_name: 'Bina Jaya Sdn Bhd', registration_no: '201501023456 1156789-K', incorporation_date: '2015-06-15' }),
    doc(DocType.CIDB, {
      company_name: 'Bina Jaya Sdn Bhd',
      registration_no: '201501023456',
      grade: opts.grade ?? 'G5',
      issue_date: '2025-01-10',
      expiry_date: '2027-01-09',
    }),
    doc(DocType.PUBLIC_LIABILITY, {
      insured_party: opts.insuranceName ?? 'Bina Jaya Sdn Bhd',
      coverage_amount: '2000000',
      issue_date: '2025-12-05',
      expiry_date: opts.insuranceExpiry ?? '2027-06-01',
    }),
    doc(DocType.WORKMEN_COMP, { company_name: 'Bina Jaya Sdn Bhd', issue_date: '2026-01-01', expiry_date: '2026-12-31' }),
    doc(DocType.TAX_CLEARANCE, { company_name: 'Bina Jaya Sdn Bhd', registration_no: '1156789-K', issue_date: '2026-09-01', expiry_date: '2027-08-31' }),
  ];
}
