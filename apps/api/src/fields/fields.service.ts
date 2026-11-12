import { Injectable } from '@nestjs/common';
import { normalizeValue } from '@vp/rules';
import { DOC_TYPE_DEFINITIONS, DocType, DocumentFieldView, DocumentStatus, ErrorCode, OrganizationType, UserRole } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { fromIsoDate } from '../common/utils/dates';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { DocumentAccessService } from '../documents/document-access.service';
import { toFieldView } from '../documents/document.mapper';
import { OrganizationsService } from '../organizations/organizations.service';
import { RemindersService } from '../reminders/reminders.service';
import type { UpdateFieldDto } from './dto/fields.dto';

@Injectable()
export class FieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DocumentAccessService,
    private readonly organizations: OrganizationsService,
    private readonly crossCheck: CrossCheckService,
    private readonly reminders: RemindersService,
    private readonly audit: AuditService,
  ) {}

  /** Confirms or corrects a value. Officers (buyers) and the supplier's own team may do this. */
  async update(user: RequestUser, fieldId: string, dto: UpdateFieldDto, ip?: string): Promise<DocumentFieldView> {
    const field = await this.prisma.documentField.findUnique({ where: { id: fieldId }, include: { document: true } });
    if (!field) throw AppException.notFound('Field');
    const doc = field.document;
    await this.access.assertCanReadSupplier(user, doc.supplierId);
    if (user.organizationType === OrganizationType.SUPPLIER && user.role !== UserRole.SUPPLIER_OWNER && user.role !== UserRole.SUPPLIER_MEMBER) throw AppException.forbidden();
    if (!doc.docType) throw new AppException(ErrorCode.VALIDATION_FAILED, 'Document has not been classified yet');
    const docType = doc.docType as DocType;
    const kind = DOC_TYPE_DEFINITIONS[docType].fields.find((f) => f.key === field.key)?.kind ?? 'text';

    let correctedValue: string | null = field.correctedValue;
    if (dto.action === 'correct') {
      if (dto.value === undefined || dto.value.trim() === '') throw new AppException(ErrorCode.VALIDATION_FAILED, 'A corrected value is required');
      correctedValue = normalizeValue(kind, dto.value.trim()) ?? dto.value.trim();
    }
    const updated = await this.prisma.documentField.update({
      where: { id: fieldId },
      data: { correctedValue, confirmedById: user.id, confirmedAt: new Date() },
      include: { confirmedBy: { select: { id: true, name: true } } },
    });

    // Keep the document's dates in step with corrections.
    if (field.key === 'expiry_date' || field.key === 'issue_date') {
      const value = updated.correctedValue ?? updated.normalizedValue;
      await this.prisma.document.update({ where: { id: doc.id }, data: field.key === 'expiry_date' ? { expiresAt: fromIsoDate(value) } : { issuedAt: fromIsoDate(value) } });
      if (field.key === 'expiry_date') await this.reminders.syncForDocument(doc.id);
    }

    const settings = await this.organizations.resolveSettings(doc.supplierId);
    const remaining = await this.prisma.documentField.count({ where: { documentId: doc.id, confirmedAt: null, confidence: { lt: settings.confidenceThreshold } } });
    if (doc.status === DocumentStatus.NEEDS_REVIEW && remaining === 0) {
      await this.prisma.document.update({ where: { id: doc.id }, data: { status: DocumentStatus.VERIFIED } });
    }
    await this.audit.log({
      actorId: user.id,
      organizationId: user.organizationId,
      action: dto.action === 'confirm' ? 'field.confirm' : 'field.correct',
      entity: 'document_field',
      entityId: fieldId,
      metadata: { documentId: doc.id, key: field.key, previous: field.correctedValue ?? field.normalizedValue, value: correctedValue },
      ip,
    });
    await this.crossCheck.recomputeForSupplier(doc.supplierId);
    return toFieldView(updated, docType, settings.confidenceThreshold);
  }
}
