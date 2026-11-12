import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ClassificationResult, DOC_TYPE_DEFINITIONS, DocType, DocumentStatus, ExtractedField } from '@vp/shared';
import { normalizeValue } from '@vp/rules';
import { fromIsoDate } from '../common/utils/dates';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { AiUsageService } from './ai-usage.service';
import { DocumentInput, EXTRACTION_PROVIDER, ExtractionProvider } from './extraction-provider.interface';

export interface NormalizedField {
  key: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: number;
  page: number;
  bbox: { x: number; y: number; width: number; height: number } | null;
}

export interface ExtractionOutcome {
  classification: ClassificationResult;
  fields: NormalizedField[];
  cached: boolean;
}

/** Runs classification + extraction (with a sha256 cache) and normalizes the values. */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    @Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider,
    private readonly prisma: PrismaService,
    private readonly usage: AiUsageService,
    private readonly config: AppConfigService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** Reuses the classification and fields of an earlier document with the same content hash. */
  async findCached(documentId: string, sha256: string): Promise<ExtractionOutcome | null> {
    const prior = await this.prisma.document.findFirst({
      where: { sha256, id: { not: documentId }, docType: { not: null }, status: { in: [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW] } },
      orderBy: { createdAt: 'desc' },
      include: { fields: true },
    });
    if (!prior || !prior.docType) return null;
    return {
      classification: { docType: prior.docType as DocType, confidence: prior.classificationConfidence ?? 1 },
      fields: prior.fields.map((f) => ({
        key: f.key,
        rawValue: f.rawValue,
        normalizedValue: f.normalizedValue,
        confidence: f.confidence,
        page: f.page,
        bbox: f.bboxX !== null && f.bboxY !== null && f.bboxWidth !== null && f.bboxHeight !== null ? { x: f.bboxX, y: f.bboxY, width: f.bboxWidth, height: f.bboxHeight } : null,
      })),
      cached: true,
    };
  }

  async classify(documentId: string, supplierId: string, input: DocumentInput): Promise<ClassificationResult> {
    const started = Date.now();
    const result = await this.provider.classify(input);
    await this.usage.record({ documentId, supplierId, operation: 'classify', model: this.modelName, usage: result.usage, durationMs: Date.now() - started });
    return result;
  }

  async extract(documentId: string, supplierId: string, input: DocumentInput, docType: DocType): Promise<NormalizedField[]> {
    const started = Date.now();
    const result = await this.provider.extract(input, docType);
    await this.usage.record({ documentId, supplierId, operation: 'extract', model: this.modelName, usage: result.usage, durationMs: Date.now() - started });
    return normalizeFields(docType, result.fields);
  }

  async recordCacheHit(documentId: string, supplierId: string): Promise<void> {
    await this.usage.record({ documentId, supplierId, operation: 'extract', model: this.modelName, usage: undefined, durationMs: 0, cached: true });
  }

  /** Persists fields and derives issuedAt / expiresAt + the review status. */
  async persist(documentId: string, docType: DocType, classification: ClassificationResult, fields: NormalizedField[], confidenceThreshold: number): Promise<DocumentStatus> {
    const def = DOC_TYPE_DEFINITIONS[docType];
    const requiredKeys = new Set(def.fields.filter((f) => f.required).map((f) => f.key));
    const needsReview = docType !== DocType.OTHER && fields.some((f) => requiredKeys.has(f.key) && f.confidence < confidenceThreshold);
    const status = needsReview ? DocumentStatus.NEEDS_REVIEW : DocumentStatus.VERIFIED;
    const issuedAt = fromIsoDate(fields.find((f) => f.key === 'issue_date')?.normalizedValue ?? fields.find((f) => f.key === 'incorporation_date')?.normalizedValue);
    const expiresAt = fromIsoDate(fields.find((f) => f.key === 'expiry_date')?.normalizedValue);
    await this.prisma.$transaction([
      this.prisma.documentField.deleteMany({ where: { documentId } }),
      this.prisma.documentField.createMany({
        data: fields.map(
          (f): Prisma.DocumentFieldCreateManyInput => ({
            documentId,
            key: f.key,
            rawValue: f.rawValue,
            normalizedValue: f.normalizedValue,
            confidence: f.confidence,
            page: f.page,
            bboxX: f.bbox?.x ?? null,
            bboxY: f.bbox?.y ?? null,
            bboxWidth: f.bbox?.width ?? null,
            bboxHeight: f.bbox?.height ?? null,
          }),
        ),
      }),
      this.prisma.document.update({
        where: { id: documentId },
        data: { docType, classificationConfidence: classification.confidence, issuedAt, expiresAt, status, progress: 100, error: null },
      }),
    ]);
    return status;
  }

  private get modelName(): string {
    return this.provider.name === 'mock' ? 'mock' : this.config.get('AI_MODEL');
  }
}

/** Normalizes raw values by field kind and drops keys the document type does not define. */
export function normalizeFields(docType: DocType, fields: ExtractedField[]): NormalizedField[] {
  const def = DOC_TYPE_DEFINITIONS[docType];
  const kinds = new Map(def.fields.map((f) => [f.key, f.kind]));
  const seen = new Set<string>();
  const out: NormalizedField[] = [];
  for (const f of fields) {
    const kind = kinds.get(f.key);
    if (!kind || seen.has(f.key)) continue;
    seen.add(f.key);
    const raw = f.rawValue?.trim() ? f.rawValue.trim() : null;
    out.push({
      key: f.key,
      rawValue: raw,
      normalizedValue: raw === null ? null : normalizeValue(kind, raw),
      confidence: clamp(f.confidence),
      page: Math.max(1, Math.round(f.page || 1)),
      bbox: f.bbox && [f.bbox.x, f.bbox.y, f.bbox.width, f.bbox.height].every((n) => typeof n === 'number' && Number.isFinite(n)) ? f.bbox : null,
    });
  }
  // Fields the model omitted are recorded as missing with zero confidence so reviewers can fill them in.
  for (const field of def.fields) {
    if (!seen.has(field.key)) out.push({ key: field.key, rawValue: null, normalizedValue: null, confidence: field.required ? 0 : 1, page: 1, bbox: null });
  }
  return out;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
