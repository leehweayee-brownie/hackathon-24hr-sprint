import { DocType, DocumentStatus, RuleCode, Severity, VendorCheckStatus, type DocumentView, type Finding, type VendorCheckView } from '@vp/shared';
import { describe, expect, it } from 'vitest';
import { assessCheck } from '@/features/vendor-checks/assessment';

const doc = (docType: DocType, status = DocumentStatus.VERIFIED): DocumentView =>
  ({ id: `doc-${docType}`, docType, status, supersededById: null, fileName: `${docType}.pdf` }) as unknown as DocumentView;

const finding = (rule: RuleCode, severity: Severity, message = `${rule} message`): Finding =>
  ({ rule, severity, message, deduction: 10, documentIds: ['doc-SSM'] }) as unknown as Finding;

function check(findings: Finding[], docs = [doc(DocType.SSM), doc(DocType.CIDB)]): VendorCheckView {
  return {
    id: 'c1',
    supplierId: 's1',
    supplierName: 'Bina Jaya Sdn Bhd',
    tenderTitle: 'Package 3B',
    contractValue: 8_000_000,
    requiredDocTypes: [DocType.SSM, DocType.CIDB],
    trustScore: 80,
    band: 'green',
    status: VendorCheckStatus.IN_REVIEW,
    findings,
    documents: docs,
  } as unknown as VendorCheckView;
}

describe('assessCheck', () => {
  it('recommends approval when every rule passes', () => {
    const a = assessCheck(check([]));
    expect(a.verdict).toBe('approve');
    expect(a.passed).toBe(a.checklist.length);
    expect(a.strengths).toContain('2 of 2 required documents on file');
    expect(a.watchOuts).toEqual([]);
  });

  it('approves with conditions when only warnings are raised', () => {
    const a = assessCheck(check([finding(RuleCode.DOCUMENT_EXPIRING_SOON, Severity.WARNING, 'ISO expires in 20 days.')]));
    expect(a.verdict).toBe('approve_with_conditions');
    expect(a.headline).toBe('Approve with 1 condition');
    expect(a.checklist.find((c) => c.key === 'validity')).toMatchObject({ state: 'condition', documentId: 'doc-SSM' });
  });

  it('asks for documents when a required one is missing', () => {
    const a = assessCheck(check([finding(RuleCode.REQUIRED_DOCUMENT_MISSING, Severity.CRITICAL)], [doc(DocType.SSM)]));
    expect(a.verdict).toBe('request_documents');
    expect(a.presentCount).toBe(1);
    expect(a.checklist.find((c) => c.key === 'documents')?.state).toBe('failed');
  });

  it('blocks approval on a critical identity mismatch', () => {
    const a = assessCheck(check([finding(RuleCode.COMPANY_NAME_MISMATCH, Severity.CRITICAL)]));
    expect(a.verdict).toBe('do_not_approve');
    expect(a.strengths).not.toContain('Company name and SSM number agree across documents');
  });
});
