import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentView, ErrorCode, MAX_FILES_PER_UPLOAD, OrganizationType, SUPPORTED_MIME_TYPES } from '@vp/shared';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import { posix, win32 } from 'node:path';
import { AuditService } from '../audit/audit.service';
import { Paginated } from '../common/dto/pagination';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { sha256 } from '../common/utils/crypto';
import { AppConfigService } from '../config/config.service';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { ExtractionService } from '../extraction/extraction.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { documentKey } from '../storage/adapters/storage.adapter';
import { StorageService } from '../storage/storage.service';
import { DocumentAccessService } from './document-access.service';
import { toDocumentView } from './document.mapper';
import { DocumentPipelineRunner } from './pipeline/document-pipeline.runner';
import type { ListDocumentsQuery } from './dto/documents.dto';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const SUPPORTED = new Set<string>(SUPPORTED_MIME_TYPES);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
    private readonly access: DocumentAccessService,
    private readonly organizations: OrganizationsService,
    private readonly crossCheck: CrossCheckService,
    private readonly audit: AuditService,
    private readonly pipeline: DocumentPipelineRunner,
    private readonly extraction: ExtractionService,
  ) {}

  /** Stores each file, detects duplicates and starts processing in the background. */
  async upload(user: RequestUser, files: UploadedFile[], ip?: string): Promise<DocumentView[]> {
    if (user.organizationType !== OrganizationType.SUPPLIER) throw AppException.forbidden('Only suppliers upload documents');
    if (!files || files.length === 0) throw new AppException(ErrorCode.VALIDATION_FAILED, 'No files were uploaded');
    if (files.length > MAX_FILES_PER_UPLOAD) throw new AppException(ErrorCode.VALIDATION_FAILED, `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time`);
    const maxBytes = this.config.get('MAX_FILE_SIZE_MB') * 1024 * 1024;
    const threshold = (await this.organizations.resolveSettings(user.organizationId)).confidenceThreshold;
    const created: DocumentView[] = [];

    for (const file of files) {
      // Folder uploads send relative paths ("bina-jaya/01-ssm.pdf"); keep the file name only.
      file.originalname = posix.basename(win32.basename(file.originalname)) || 'document';
      if (file.size > maxBytes) throw new AppException(ErrorCode.FILE_TOO_LARGE, `${file.originalname} is larger than ${this.config.get('MAX_FILE_SIZE_MB')} MB`, HttpStatus.PAYLOAD_TOO_LARGE);
      const mimeType = await this.detectMime(file);
      const hash = sha256(file.buffer);
      // An identical file this supplier already has, read by the model in use now. A copy read by another
      // provider or model (for example the offline mock) does not count, so the file is read again.
      const original = await this.prisma.document.findFirst({
        where: {
          supplierId: user.organizationId,
          sha256: hash,
          duplicateOfId: null,
          docType: { not: null },
          extractedBy: this.extraction.currentModel,
          status: { in: [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW] },
        },
        orderBy: { createdAt: 'asc' },
        include: { fields: true },
      });

      const doc = await this.prisma.document.create({
        data: {
          supplierId: user.organizationId,
          fileKey: '',
          fileName: file.originalname,
          mimeType,
          size: file.size,
          sha256: hash,
          uploadedById: user.id,
          status: DocumentStatus.UPLOADED,
          duplicateOfId: original?.id ?? null,
        },
      });
      const key = documentKey(user.organizationId, doc.id, file.originalname);
      await this.storage.put(key, file.buffer, { contentType: mimeType, fileName: file.originalname });
      let updated = await this.prisma.document.update({ where: { id: doc.id }, data: { fileKey: key }, include: { fields: true } });

      if (original) {
        // Exact duplicate of a file already read by the current model: copy the result, keep it out of the rules (superseded by the original).
        updated = await this.prisma.document.update({
          where: { id: doc.id },
          data: {
            docType: original.docType,
            classificationConfidence: original.classificationConfidence,
            extractedBy: original.extractedBy,
            pageCount: original.pageCount,
            issuedAt: original.issuedAt,
            expiresAt: original.expiresAt,
            status: original.status,
            progress: 100,
            supersededById: original.id,
            fields: {
              createMany: {
                data: original.fields.map((f): Prisma.DocumentFieldCreateManyDocumentInput => ({
                  key: f.key, rawValue: f.rawValue, normalizedValue: f.normalizedValue, confidence: f.confidence, page: f.page,
                  bboxX: f.bboxX, bboxY: f.bboxY, bboxWidth: f.bboxWidth, bboxHeight: f.bboxHeight,
                })),
              },
            },
          },
          include: { fields: true },
        });
      } else {
        await this.enqueue(doc.id);
      }
      await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'document.upload', entity: 'document', entityId: doc.id, metadata: { fileName: file.originalname, duplicateOf: original?.id ?? null }, ip });
      created.push(toDocumentView(updated, threshold));
    }
    return created;
  }

  /** Starts processing in the background, in this process. Returns at once. */
  async enqueue(documentId: string): Promise<void> {
    this.pipeline.schedule(documentId);
  }

  async list(user: RequestUser, query: ListDocumentsQuery): Promise<Paginated<DocumentView>> {
    const supplierId = user.organizationType === OrganizationType.SUPPLIER ? user.organizationId : query.supplierId;
    if (!supplierId) throw new AppException(ErrorCode.VALIDATION_FAILED, 'supplierId is required');
    await this.access.assertCanReadSupplier(user, supplierId);
    const where: Prisma.DocumentWhereInput = {
      supplierId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.docType ? { docType: query.docType } : {}),
      ...(query.includeSuperseded === 'true' ? {} : { supersededById: null }),
    };
    const [items, total, settings] = await Promise.all([
      this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize, include: { fields: { include: { confirmedBy: { select: { id: true, name: true } } } } } }),
      this.prisma.document.count({ where }),
      this.organizations.resolveSettings(supplierId),
    ]);
    return Paginated.of(items.map((d) => toDocumentView(d, settings.confidenceThreshold)), total, query);
  }

  async get(user: RequestUser, id: string): Promise<DocumentView> {
    const doc = await this.prisma.document.findUnique({ where: { id }, include: { fields: { include: { confirmedBy: { select: { id: true, name: true } } }, orderBy: { key: 'asc' } } } });
    if (!doc) throw AppException.notFound('Document');
    await this.access.assertCanReadSupplier(user, doc.supplierId);
    const settings = await this.organizations.resolveSettings(doc.supplierId);
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'document.view', entity: 'document', entityId: id });
    return toDocumentView(doc, settings.confidenceThreshold);
  }

  async fileUrl(user: RequestUser, id: string): Promise<{ url: string; expiresIn: number; mimeType: string; fileName: string }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw AppException.notFound('Document');
    await this.access.assertCanReadSupplier(user, doc.supplierId);
    return this.signedUrlFor(doc);
  }

  async signedUrlFor(doc: { fileKey: string; fileName: string; mimeType: string }) {
    const expiresIn = this.config.get('SIGNED_URL_TTL_SECONDS');
    const url = await this.storage.signedUrl(doc.fileKey, doc.fileName, expiresIn);
    return { url, expiresIn, mimeType: doc.mimeType, fileName: doc.fileName };
  }

  async remove(user: RequestUser, id: string): Promise<{ deleted: true }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw AppException.notFound('Document');
    this.access.assertCanWriteSupplier(user, doc.supplierId);
    await this.prisma.document.delete({ where: { id } });
    await this.storage.delete(doc.fileKey).catch((err) => this.logger.warn(`Could not delete ${doc.fileKey}: ${(err as Error).message}`));
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'document.delete', entity: 'document', entityId: id, metadata: { fileName: doc.fileName } });
    await this.crossCheck.recomputeForSupplier(doc.supplierId);
    return { deleted: true };
  }

  async reprocess(user: RequestUser, id: string): Promise<DocumentView> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw AppException.notFound('Document');
    this.access.assertCanWriteSupplier(user, doc.supplierId);
    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.UPLOADED, progress: 0, error: null, attempts: 0, supersededById: null, duplicateOfId: null, fields: { deleteMany: {} } },
      include: { fields: true },
    });
    await this.enqueue(id);
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'document.reprocess', entity: 'document', entityId: id });
    const settings = await this.organizations.resolveSettings(doc.supplierId);
    return toDocumentView(updated, settings.confidenceThreshold);
  }

  /** Checks the content, not the extension. */
  private async detectMime(file: UploadedFile): Promise<string> {
    const detected = await fileTypeFromBuffer(file.buffer);
    const mime = detected?.mime;
    if (!mime || !SUPPORTED.has(mime)) {
      throw new AppException(ErrorCode.UNSUPPORTED_FILE_TYPE, `${file.originalname}: only PDF, JPG, PNG and HEIC files are supported`, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    return mime;
  }
}
