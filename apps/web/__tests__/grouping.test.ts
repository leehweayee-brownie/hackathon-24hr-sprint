import { DocType, DocumentStatus, type DocumentView } from '@vp/shared';
import { describe, expect, it } from 'vitest';
import { applyDocumentUpdate, columnFor, countNeedsReview, groupDocuments } from '@/features/intake/grouping';

let n = 0;
function doc(partial: Partial<DocumentView>): DocumentView {
  n += 1;
  return {
    id: `d${n}`,
    supplierId: 's1',
    fileName: `file-${n}.pdf`,
    mimeType: 'application/pdf',
    size: 1,
    pageCount: 1,
    sha256: `h${n}`,
    docType: null,
    docTypeLabel: null,
    classificationConfidence: null,
    status: DocumentStatus.UPLOADED,
    progress: 0,
    error: null,
    issuedAt: null,
    expiresAt: null,
    supersededById: null,
    uploadedBy: 'u1',
    createdAt: new Date(2026, 0, n).toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('intake grouping', () => {
  it('keeps unclassified documents in Processing until classified', () => {
    expect(columnFor(doc({ status: DocumentStatus.CLASSIFYING }))).toBe('PROCESSING');
    expect(columnFor(doc({ status: DocumentStatus.EXTRACTING, docType: DocType.CIDB }))).toBe(DocType.CIDB);
    expect(columnFor(doc({ status: DocumentStatus.FAILED, docType: DocType.SSM }))).toBe('FAILED');
    expect(columnFor(doc({ status: DocumentStatus.VERIFIED, docType: DocType.OTHER }))).toBe(DocType.OTHER);
  });

  it('groups by type and hides superseded documents by default', () => {
    const docs = [
      doc({ status: DocumentStatus.VERIFIED, docType: DocType.SSM }),
      doc({ status: DocumentStatus.VERIFIED, docType: DocType.PUBLIC_LIABILITY, supersededById: 'x' }),
      doc({ status: DocumentStatus.NEEDS_REVIEW, docType: DocType.PUBLIC_LIABILITY }),
      doc({ status: DocumentStatus.CONVERTING }),
    ];
    const cols = groupDocuments(docs);
    const byKey = Object.fromEntries(cols.map((c) => [c.key, c.documents.length]));
    expect(byKey.PROCESSING).toBe(1);
    expect(byKey[DocType.SSM]).toBe(1);
    expect(byKey[DocType.PUBLIC_LIABILITY]).toBe(1);
    expect(groupDocuments(docs, { includeSuperseded: true }).find((c) => c.key === DocType.PUBLIC_LIABILITY)!.documents).toHaveLength(2);
  });

  it('sorts newest first and can hide empty columns', () => {
    const a = doc({ status: DocumentStatus.VERIFIED, docType: DocType.ISO });
    const b = doc({ status: DocumentStatus.VERIFIED, docType: DocType.ISO });
    const cols = groupDocuments([a, b], { hideEmpty: true });
    expect(cols.map((c) => c.key)).toEqual(['PROCESSING', DocType.ISO]);
    expect(cols[1].documents.map((d) => d.id)).toEqual([b.id, a.id]);
  });

  it('counts fields that need confirmation', () => {
    const d = doc({
      status: DocumentStatus.NEEDS_REVIEW,
      docType: DocType.CIDB,
      fields: [
        { id: 'f1', key: 'grade', label: 'Grade', rawValue: 'G5', normalizedValue: 'G5', correctedValue: null, value: 'G5', confidence: 0.6, page: 1, bbox: null, confirmedBy: null, confirmedAt: null, needsConfirmation: true },
        { id: 'f2', key: 'company_name', label: 'Company', rawValue: 'X', normalizedValue: 'X', correctedValue: null, value: 'X', confidence: 0.99, page: 1, bbox: null, confirmedBy: null, confirmedAt: null, needsConfirmation: false },
      ],
    });
    expect(countNeedsReview(d)).toBe(1);
    expect(countNeedsReview(doc({ status: DocumentStatus.NEEDS_REVIEW }))).toBe(1);
  });

  it('applies socket updates in place', () => {
    const d = doc({ status: DocumentStatus.CLASSIFYING });
    const updated = applyDocumentUpdate([d], { id: d.id, docType: DocType.SSM, classificationConfidence: 0.97 });
    expect(updated[0].docType).toBe(DocType.SSM);
    expect(columnFor(updated[0])).toBe(DocType.SSM);
  });
});
