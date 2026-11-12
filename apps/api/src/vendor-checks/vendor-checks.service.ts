import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type VendorCheck } from '@prisma/client';
import { DEFAULT_REQUIRED_DOC_TYPES, DocType, DocumentStatus, ErrorCode, OrganizationType, ScoreBand, UserRole, VendorCheckStatus, VendorCheckView, scoreBand } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import { Paginated } from '../common/dto/pagination';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { toDocumentView, toFieldView } from '../documents/document.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { CreateVendorCheckDto, DecisionDto, ListVendorChecksQuery, RequestInfoDto, UpdateVendorCheckDto } from './dto/vendor-checks.dto';

type CheckRow = VendorCheck & { supplier: { name: string }; decidedBy?: { name: string } | null };

const DECIDED: VendorCheckStatus[] = [VendorCheckStatus.APPROVED, VendorCheckStatus.REJECTED];

@Injectable()
export class VendorChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly crossCheck: CrossCheckService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(user: RequestUser, dto: CreateVendorCheckDto): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const supplier = await this.prisma.organization.findFirst({ where: { id: dto.supplierId, type: 'SUPPLIER' } });
    if (!supplier) throw AppException.notFound('Supplier');
    const check = await this.prisma.vendorCheck.create({
      data: {
        buyerId: user.organizationId,
        supplierId: dto.supplierId,
        tenderTitle: dto.tenderTitle.trim(),
        contractValue: new Prisma.Decimal(dto.contractValue),
        requiredDocTypes: dto.requiredDocTypes?.length ? dto.requiredDocTypes : DEFAULT_REQUIRED_DOC_TYPES,
        status: VendorCheckStatus.IN_REVIEW,
        createdById: user.id,
      },
    });
    await this.crossCheck.recomputeCheck(check);
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'vendor_check.create', entity: 'vendor_check', entityId: check.id, metadata: { supplierId: dto.supplierId, contractValue: dto.contractValue } });
    await this.notifications.notifyOrg(dto.supplierId, {
      type: 'vendor_check.created',
      title: `${user.organizationName} started a vendor check`,
      message: `${user.organizationName} is reviewing your documents for "${check.tenderTitle}". Keep your passport current to speed things up.`,
      link: '/supplier/passport',
    });
    return this.get(user, check.id);
  }

  async list(user: RequestUser, query: ListVendorChecksQuery): Promise<Paginated<VendorCheckView>> {
    const where: Prisma.VendorCheckWhereInput = {
      ...(user.role === UserRole.ADMIN ? {} : user.organizationType === OrganizationType.BUYER ? { buyerId: user.organizationId } : { supplierId: user.organizationId }),
      ...(query.status ? { status: query.status as VendorCheckStatus } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.vendorCheck.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize, include: { supplier: { select: { name: true } }, decidedBy: { select: { name: true } } } }),
      this.prisma.vendorCheck.count({ where }),
    ]);
    const settings = await this.organizations.resolveSettings(user.organizationType === OrganizationType.BUYER ? user.organizationId : null);
    return Paginated.of(rows.map((r) => this.toView(r, settings.approverThreshold)), total, query);
  }

  async get(user: RequestUser, id: string): Promise<VendorCheckView> {
    const check = await this.load(user, id);
    const [buyerSettings, ruleDocs, findings, docs] = await Promise.all([
      this.organizations.resolveSettings(check.buyerId),
      this.crossCheck.buildRuleDocuments(check.supplierId),
      this.crossCheck.findings(check.supplierId, check.id),
      this.prisma.document.findMany({ where: { supplierId: check.supplierId, supersededById: null }, include: { fields: { include: { confirmedBy: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const threshold = buyerSettings.confidenceThreshold;
    const required = new Set(check.requiredDocTypes as DocType[]);
    const lowConfidenceFields = docs
      .filter((d) => d.docType && [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW].includes(d.status as DocumentStatus))
      .flatMap((d) => d.fields.filter((f) => f.confirmedAt === null && f.confidence < threshold).map((f) => ({ ...toFieldView(f, d.docType as DocType, threshold), documentId: d.id, docType: d.docType as DocType, required: required.has(d.docType as DocType) })));
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'vendor_check.view', entity: 'vendor_check', entityId: id });
    return {
      ...this.toView(check, buyerSettings.approverThreshold),
      findings,
      timeline: this.crossCheck.timeline(ruleDocs, buyerSettings),
      documents: docs.map((d) => toDocumentView(d, threshold)),
      lowConfidenceFields,
    };
  }

  async update(user: RequestUser, id: string, dto: UpdateVendorCheckDto): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const check = await this.load(user, id);
    if (DECIDED.includes(check.status as VendorCheckStatus)) throw AppException.conflict('This check has already been decided');
    const updated = await this.prisma.vendorCheck.update({
      where: { id },
      data: {
        ...(dto.tenderTitle !== undefined ? { tenderTitle: dto.tenderTitle.trim() } : {}),
        ...(dto.contractValue !== undefined ? { contractValue: new Prisma.Decimal(dto.contractValue) } : {}),
        ...(dto.requiredDocTypes !== undefined ? { requiredDocTypes: dto.requiredDocTypes.length ? dto.requiredDocTypes : DEFAULT_REQUIRED_DOC_TYPES } : {}),
      },
    });
    await this.crossCheck.recomputeCheck(updated);
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'vendor_check.update', entity: 'vendor_check', entityId: id, metadata: { ...dto } });
    return this.get(user, id);
  }

  async requestInfo(user: RequestUser, id: string, dto: RequestInfoDto): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const check = await this.load(user, id);
    if (DECIDED.includes(check.status as VendorCheckStatus)) throw AppException.conflict('This check has already been decided');
    const text = dto.text || 'Please upload the missing or renewed documents.';
    await this.prisma.vendorCheck.update({ where: { id }, data: { status: VendorCheckStatus.MORE_INFO, decisionNote: text } });
    await this.notifications.notifyOrg(check.supplierId, {
      type: 'vendor_check.more_info',
      title: `${user.organizationName} needs more documents`,
      message: `For "${check.tenderTitle}": ${text}`,
      link: '/supplier/documents',
      email: true,
    });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'vendor_check.request_info', entity: 'vendor_check', entityId: id, metadata: { message: text } });
    return this.get(user, id);
  }

  async approve(user: RequestUser, id: string, dto: DecisionDto): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const check = await this.load(user, id);
    if (DECIDED.includes(check.status as VendorCheckStatus)) throw AppException.conflict('This check has already been decided');
    const settings = await this.organizations.resolveSettings(check.buyerId);
    if (Number(check.contractValue) > settings.approverThreshold && user.role !== UserRole.BUYER_APPROVER && user.role !== UserRole.ADMIN) {
      throw new AppException(ErrorCode.APPROVER_REQUIRED, `Contracts above RM${settings.approverThreshold.toLocaleString('en-MY')} need an approver's sign-off`, HttpStatus.FORBIDDEN);
    }
    const unconfirmed = await this.prisma.documentField.count({
      where: {
        confirmedAt: null,
        confidence: { lt: settings.confidenceThreshold },
        document: { supplierId: check.supplierId, supersededById: null, docType: { in: check.requiredDocTypes }, status: { in: [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW] } },
      },
    });
    if (unconfirmed > 0) {
      throw new AppException(ErrorCode.FIELD_CONFIRMATION_REQUIRED, `${unconfirmed} low-confidence field${unconfirmed === 1 ? '' : 's'} on required documents must be confirmed before approval`, HttpStatus.CONFLICT);
    }
    await this.decide(user, check, VendorCheckStatus.APPROVED, dto.note);
    return this.get(user, id);
  }

  async reject(user: RequestUser, id: string, dto: DecisionDto): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const check = await this.load(user, id);
    if (DECIDED.includes(check.status as VendorCheckStatus)) throw AppException.conflict('This check has already been decided');
    await this.decide(user, check, VendorCheckStatus.REJECTED, dto.note);
    return this.get(user, id);
  }

  async suppliers(user: RequestUser, q?: string) {
    this.assertBuyer(user);
    const orgs = await this.prisma.organization.findMany({ where: { type: 'SUPPLIER', ...(q?.trim() ? { OR: [{ name: { contains: q.trim(), mode: 'insensitive' } }, { registrationNo: { contains: q.trim(), mode: 'insensitive' } }] } : {}) }, orderBy: { name: 'asc' }, include: { passport: { select: { trustScore: true, status: true } } } });
    return orgs.map((o) => ({ id: o.id, name: o.name, registrationNo: o.registrationNo, trustScore: o.passport?.trustScore ?? null, passportStatus: o.passport?.status ?? null }));
  }

  private async decide(user: RequestUser, check: CheckRow, status: VendorCheckStatus, note?: string): Promise<void> {
    await this.prisma.vendorCheck.update({ where: { id: check.id }, data: { status, decidedById: user.id, decidedAt: new Date(), decisionNote: note ?? null } });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: `vendor_check.${status.toLowerCase()}`, entity: 'vendor_check', entityId: check.id, metadata: { note: note ?? null, trustScore: check.trustScore } });
    await this.notifications.notifyOrg(check.supplierId, {
      type: `vendor_check.${status.toLowerCase()}`,
      title: status === VendorCheckStatus.APPROVED ? `${user.organizationName} approved you for "${check.tenderTitle}"` : `${user.organizationName} rejected "${check.tenderTitle}"`,
      message: note?.trim() || (status === VendorCheckStatus.APPROVED ? 'Your documents passed the vendor check.' : 'See the findings on your passport for what to fix.'),
      link: '/supplier/passport',
      email: true,
    });
  }

  private async load(user: RequestUser, id: string): Promise<CheckRow> {
    const check = await this.prisma.vendorCheck.findUnique({ where: { id }, include: { supplier: { select: { name: true } }, decidedBy: { select: { name: true } } } });
    if (!check) throw AppException.notFound('Vendor check');
    const allowed = user.role === UserRole.ADMIN || check.buyerId === user.organizationId || check.supplierId === user.organizationId;
    if (!allowed) throw AppException.forbidden();
    return check;
  }

  private assertBuyer(user: RequestUser): void {
    if (user.organizationType !== OrganizationType.BUYER && user.role !== UserRole.ADMIN) throw AppException.forbidden('Only buyer officers can do this');
  }

  private toView(c: CheckRow, approverThreshold: number): VendorCheckView {
    const contractValue = Number(c.contractValue);
    return {
      id: c.id,
      buyerId: c.buyerId,
      supplierId: c.supplierId,
      supplierName: c.supplier.name,
      tenderTitle: c.tenderTitle,
      contractValue,
      requiredDocTypes: c.requiredDocTypes as DocType[],
      trustScore: c.trustScore,
      band: c.trustScore === null ? null : (scoreBand(c.trustScore) as ScoreBand),
      status: c.status as VendorCheckStatus,
      decidedBy: c.decidedById,
      decidedByName: c.decidedBy?.name ?? null,
      decidedAt: c.decidedAt?.toISOString() ?? null,
      decisionNote: c.decisionNote,
      requiresApprover: contractValue > approverThreshold,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
