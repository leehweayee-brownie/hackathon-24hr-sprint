import { DOC_TYPES, DocType, DocumentStatus, type DocumentView } from '@vp/shared';
import { isProcessing } from '@/utils/status';

export type ColumnKey = DocType | 'PROCESSING' | 'FAILED';

export interface IntakeColumn {
  key: ColumnKey;
  label: string;
  documents: DocumentView[];
}

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  PROCESSING: 'Processing',
  [DocType.SSM]: 'SSM registration',
  [DocType.CIDB]: 'CIDB certificate',
  [DocType.PUBLIC_LIABILITY]: 'Public liability',
  [DocType.WORKMEN_COMP]: "Workmen's comp / SOCSO",
  [DocType.TAX_CLEARANCE]: 'LHDN tax clearance',
  [DocType.BANK_REFERENCE]: 'Bank reference',
  [DocType.ISO]: 'ISO / quality',
  [DocType.OTHER]: 'Other',
  FAILED: 'Unreadable / failed',
};

export const COLUMN_ORDER: ColumnKey[] = ['PROCESSING', ...DOC_TYPES, 'FAILED'];

/** Which column a document belongs in. A document stays in Processing until it has been classified. */
export function columnFor(doc: DocumentView): ColumnKey {
  if (doc.status === DocumentStatus.FAILED) return 'FAILED';
  if (doc.docType) return doc.docType;
  if (isProcessing(doc.status)) return 'PROCESSING';
  return DocType.OTHER;
}

export function groupDocuments(documents: DocumentView[], opts: { hideEmpty?: boolean; includeSuperseded?: boolean } = {}): IntakeColumn[] {
  const map = new Map<ColumnKey, DocumentView[]>();
  for (const key of COLUMN_ORDER) map.set(key, []);
  for (const doc of documents) {
    if (!opts.includeSuperseded && doc.supersededById) continue;
    map.get(columnFor(doc))!.push(doc);
  }
  const columns = COLUMN_ORDER.map((key) => ({
    key,
    label: COLUMN_LABELS[key],
    documents: (map.get(key) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));
  return opts.hideEmpty ? columns.filter((c) => c.documents.length > 0 || c.key === 'PROCESSING') : columns;
}

export function countNeedsReview(doc: DocumentView, threshold = 0.85): number {
  if (!doc.fields) return doc.status === DocumentStatus.NEEDS_REVIEW ? 1 : 0;
  return doc.fields.filter((f) => f.needsConfirmation || (!f.confirmedAt && f.confidence < threshold)).length;
}

/** Merge a socket status/classification update into a cached list without refetching. */
export function applyDocumentUpdate(list: DocumentView[], update: Partial<DocumentView> & { id: string }): DocumentView[] {
  return list.map((d) => (d.id === update.id ? { ...d, ...update } : d));
}
