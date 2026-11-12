import type { Document, DocumentField, User } from '@prisma/client';
import { DOC_TYPE_DEFINITIONS, DocType, DocumentFieldView, DocumentStatus, DocumentView, docTypeLabel, fieldLabel } from '@vp/shared';
import { toIsoDate } from '../common/utils/dates';

export type FieldWithUser = DocumentField & { confirmedBy?: Pick<User, 'id' | 'name'> | null };
export type DocumentWithFields = Document & { fields?: FieldWithUser[] };

export function effectiveValue(f: Pick<DocumentField, 'correctedValue' | 'normalizedValue' | 'rawValue'>): string | null {
  return f.correctedValue ?? f.normalizedValue ?? f.rawValue ?? null;
}

/**
 * Value handed to the rules engine. Company names keep their printed form, because the engine normalizes
 * names itself before comparing and quotes them in findings ("Bina Jaya Engineering Sdn Bhd").
 */
export function ruleValue(f: Pick<DocumentField, 'key' | 'correctedValue' | 'normalizedValue' | 'rawValue'>, docType: DocType): string | null {
  const kind = DOC_TYPE_DEFINITIONS[docType]?.fields.find((d) => d.key === f.key)?.kind;
  if (kind === 'company_name') return f.correctedValue ?? f.rawValue ?? f.normalizedValue ?? null;
  return effectiveValue(f);
}

export function toFieldView(f: FieldWithUser, docType: DocType | null, threshold: number): DocumentFieldView {
  const bbox = f.bboxX !== null && f.bboxY !== null && f.bboxWidth !== null && f.bboxHeight !== null ? { x: f.bboxX, y: f.bboxY, width: f.bboxWidth, height: f.bboxHeight } : null;
  return {
    id: f.id,
    key: f.key,
    label: docType ? fieldLabel(docType, f.key) : f.key,
    rawValue: f.rawValue,
    normalizedValue: f.normalizedValue,
    correctedValue: f.correctedValue,
    value: effectiveValue(f),
    confidence: f.confidence,
    page: f.page,
    bbox,
    confirmedBy: f.confirmedById,
    confirmedByName: f.confirmedBy?.name ?? null,
    confirmedAt: f.confirmedAt?.toISOString() ?? null,
    needsConfirmation: f.confirmedAt === null && f.confidence < threshold,
  };
}

export function toDocumentView(d: DocumentWithFields, threshold: number): DocumentView {
  const docType = (d.docType as DocType | null) ?? null;
  return {
    id: d.id,
    supplierId: d.supplierId,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    pageCount: d.pageCount,
    sha256: d.sha256,
    docType,
    docTypeLabel: docType ? docTypeLabel(docType) : null,
    classificationConfidence: d.classificationConfidence,
    status: d.status as DocumentStatus,
    progress: d.progress,
    error: d.error,
    issuedAt: toIsoDate(d.issuedAt),
    expiresAt: toIsoDate(d.expiresAt),
    supersededById: d.supersededById,
    duplicateOfId: d.duplicateOfId,
    uploadedBy: d.uploadedById,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    ...(d.fields ? { fields: d.fields.map((f) => toFieldView(f, docType, threshold)) } : {}),
  };
}
