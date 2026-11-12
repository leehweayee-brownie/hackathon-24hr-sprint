import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DocType, DocumentStatus, SOCKET_EVENTS, docTypeLabel } from '@vp/shared';
import { Job, UnrecoverableError } from 'bullmq';
import { AppException } from '../common/errors/app.exception';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { toFieldView } from '../documents/document.mapper';
import { ExtractionService } from '../extraction/extraction.service';
import { PagePrepService } from '../extraction/page-prep.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { RemindersService } from '../reminders/reminders.service';
import { StorageService } from '../storage/storage.service';
import { DOCUMENTS_QUEUE, ProcessDocumentJob } from './documents.queue';

const PROGRESS = { CONVERTING: 10, CLASSIFYING: 35, EXTRACTING: 60, DONE: 100 } as const;

/**
 * UPLOADED → CONVERTING → CLASSIFYING → EXTRACTING → NEEDS_REVIEW | VERIFIED, FAILED on error (3 attempts).
 */
@Processor(DOCUMENTS_QUEUE, { concurrency: 4 })
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pagePrep: PagePrepService,
    private readonly extraction: ExtractionService,
    private readonly crossCheck: CrossCheckService,
    private readonly reminders: RemindersService,
    private readonly organizations: OrganizationsService,
    private readonly realtime: RealtimePublisher,
  ) {
    super();
  }

  async process(job: Job<ProcessDocumentJob>): Promise<void> {
    const { documentId } = job.data;
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) {
      this.logger.warn(`Document ${documentId} no longer exists; skipping`);
      return;
    }
    const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    try {
      await this.run(doc.id, doc.supplierId, doc.fileKey, doc.fileName, doc.mimeType, doc.sha256);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const unrecoverable = err instanceof AppException;
      this.logger.error(`Document ${documentId} failed (attempt ${job.attemptsMade + 1}): ${message}`);
      await this.prisma.document.update({ where: { id: documentId }, data: { attempts: { increment: 1 }, error: message, ...(lastAttempt || unrecoverable ? { status: DocumentStatus.FAILED } : {}) } });
      if (lastAttempt || unrecoverable) {
        await this.realtime.toSupplier(doc.supplierId, SOCKET_EVENTS.documentStatus, { documentId, status: DocumentStatus.FAILED, progress: 0, error: message });
        await this.realtime.toSupplier(doc.supplierId, SOCKET_EVENTS.error, { code: 'EXTRACTION_FAILED', message: `${doc.fileName}: ${message}` });
      }
      if (unrecoverable) throw new UnrecoverableError(message);
      throw err;
    }
  }

  private async run(documentId: string, supplierId: string, fileKey: string, fileName: string, mimeType: string, sha256: string): Promise<void> {
    const settings = await this.organizations.resolveSettings(supplierId);

    await this.setStatus(documentId, supplierId, DocumentStatus.CONVERTING, PROGRESS.CONVERTING);
    const cached = await this.extraction.findCached(documentId, sha256);
    let classification = cached?.classification;
    let fields = cached?.fields;

    if (cached) {
      await this.prisma.document.update({ where: { id: documentId }, data: { pageCount: await this.pageCountOf(fileKey, mimeType) } });
      await this.extraction.recordCacheHit(documentId, supplierId);
      await this.setStatus(documentId, supplierId, DocumentStatus.CLASSIFYING, PROGRESS.CLASSIFYING);
      await this.realtime.toSupplier(supplierId, SOCKET_EVENTS.documentClassified, { documentId, docType: cached.classification.docType, confidence: cached.classification.confidence });
      await this.setStatus(documentId, supplierId, DocumentStatus.EXTRACTING, PROGRESS.EXTRACTING);
    } else {
      const buffer = await this.storage.get(fileKey);
      const input = await this.pagePrep.prepare(buffer, mimeType, fileName, sha256);
      await this.prisma.document.update({ where: { id: documentId }, data: { pageCount: input.pageCount } });

      await this.setStatus(documentId, supplierId, DocumentStatus.CLASSIFYING, PROGRESS.CLASSIFYING);
      classification = await this.extraction.classify(documentId, supplierId, input);
      await this.prisma.document.update({ where: { id: documentId }, data: { docType: classification.docType, classificationConfidence: classification.confidence } });
      await this.realtime.toSupplier(supplierId, SOCKET_EVENTS.documentClassified, { documentId, docType: classification.docType, confidence: classification.confidence });

      await this.setStatus(documentId, supplierId, DocumentStatus.EXTRACTING, PROGRESS.EXTRACTING);
      fields = await this.extraction.extract(documentId, supplierId, input, classification.docType);
    }

    const docType = classification!.docType;
    const status = await this.extraction.persist(documentId, docType, classification!, fields!, settings.confidenceThreshold);
    const saved = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId }, include: { fields: true } });
    await this.realtime.toSupplier(supplierId, SOCKET_EVENTS.documentExtracted, { documentId, fields: saved.fields.map((f) => toFieldView(f, docType, settings.confidenceThreshold)) });

    const superseded = await this.applySupersession(supplierId, docType);
    await this.reminders.syncForDocument(documentId);
    for (const id of superseded) await this.reminders.syncForDocument(id);
    await this.setStatus(documentId, supplierId, status, PROGRESS.DONE);
    await this.crossCheck.recomputeForSupplier(supplierId);

    if (superseded.length > 0 && docType !== DocType.OTHER) {
      const supplier = await this.prisma.organization.findUnique({ where: { id: supplierId }, select: { name: true } });
      await this.reminders.notifyBuyers(supplierId, supplier?.name ?? 'Supplier', docTypeLabel(docType), '', true);
    }
    this.logger.log(`Document ${documentId} (${fileName}) → ${docType} ${status}${cached ? ' [cached]' : ''}`);
  }

  /** The newest document of a type (by expiry, then issue date, then upload time) supersedes the others. Returns the superseded ids. */
  private async applySupersession(supplierId: string, docType: DocType): Promise<string[]> {
    if (docType === DocType.OTHER) return [];
    const docs = await this.prisma.document.findMany({
      where: { supplierId, docType, status: { in: [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW] }, duplicateOfId: null },
    });
    if (docs.length < 2) return [];
    const key = (d: (typeof docs)[number]) => `${d.expiresAt?.toISOString() ?? '0000'}|${d.issuedAt?.toISOString() ?? '0000'}|${d.createdAt.toISOString()}`;
    const [winner, ...rest] = [...docs].sort((a, b) => key(b).localeCompare(key(a)));
    const superseded: string[] = [];
    for (const d of rest) {
      if (d.supersededById !== winner.id) {
        await this.prisma.document.update({ where: { id: d.id }, data: { supersededById: winner.id } });
        superseded.push(d.id);
      }
    }
    if (winner.supersededById) await this.prisma.document.update({ where: { id: winner.id }, data: { supersededById: null } });
    return superseded;
  }

  private async pageCountOf(fileKey: string, mimeType: string): Promise<number> {
    if (mimeType !== 'application/pdf') return 1;
    return this.pagePrep.pageCount(await this.storage.get(fileKey), mimeType);
  }

  private async setStatus(documentId: string, supplierId: string, status: DocumentStatus, progress: number): Promise<void> {
    await this.prisma.document.update({ where: { id: documentId }, data: { status, progress } });
    await this.realtime.toSupplier(supplierId, SOCKET_EVENTS.documentStatus, { documentId, status, progress });
  }
}
