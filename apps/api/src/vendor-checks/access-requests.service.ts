import { Injectable } from '@nestjs/common';
import { AccessRequestStatus } from '@prisma/client';
import { OrganizationType, UserRole } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PassportsService } from '../passports/passports.service';
import type { CreateAccessRequestDto } from './dto/vendor-checks.dto';

@Injectable()
export class AccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passports: PassportsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(user: RequestUser, dto: CreateAccessRequestDto) {
    if (user.organizationType !== OrganizationType.BUYER) throw AppException.forbidden('Only buyers request passport access');
    const supplier = await this.prisma.organization.findFirst({ where: { id: dto.supplierId, type: 'SUPPLIER' } });
    if (!supplier) throw AppException.notFound('Vendor');
    const existing = await this.prisma.accessRequest.findFirst({ where: { buyerId: user.organizationId, supplierId: dto.supplierId, status: AccessRequestStatus.PENDING } });
    if (existing) return this.toView(await this.prisma.accessRequest.findUniqueOrThrow({ where: { id: existing.id }, include: { buyer: true, supplier: true, requestedBy: true } }));
    const req = await this.prisma.accessRequest.create({
      data: { buyerId: user.organizationId, supplierId: dto.supplierId, requestedById: user.id, message: dto.message?.trim() || null },
      include: { buyer: true, supplier: true, requestedBy: true },
    });
    await this.notifications.notifyOrg(dto.supplierId, {
      type: 'access_request.created',
      title: `${user.organizationName} asked for your Vendor Passport`,
      message: dto.message?.trim() || `${user.name} from ${user.organizationName} would like to view your passport.`,
      link: '/supplier/passport',
      email: true,
    });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'access_request.create', entity: 'access_request', entityId: req.id, metadata: { supplierId: dto.supplierId } });
    return this.toView(req);
  }

  async list(user: RequestUser, status?: string) {
    const scope = user.organizationType === OrganizationType.SUPPLIER ? { supplierId: user.organizationId } : user.role === UserRole.ADMIN ? {} : { buyerId: user.organizationId };
    const where = { ...scope, ...(status && status in AccessRequestStatus ? { status: status as AccessRequestStatus } : {}) };
    const rows = await this.prisma.accessRequest.findMany({ where, orderBy: { createdAt: 'desc' }, include: { buyer: true, supplier: true, requestedBy: true } });
    return rows.map((r) => this.toView(r));
  }

  async grant(user: RequestUser, id: string) {
    const req = await this.loadForSupplier(user, id);
    const share = await this.passports.createShare(user, { buyerId: req.buyerId, label: `Access request from ${req.buyer.name}` });
    const updated = await this.prisma.accessRequest.update({ where: { id }, data: { status: AccessRequestStatus.GRANTED, shareId: share.id }, include: { buyer: true, supplier: true, requestedBy: true } });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'access_request.grant', entity: 'access_request', entityId: id });
    return { ...this.toView(updated), share };
  }

  async decline(user: RequestUser, id: string) {
    await this.loadForSupplier(user, id);
    const updated = await this.prisma.accessRequest.update({ where: { id }, data: { status: AccessRequestStatus.DECLINED }, include: { buyer: true, supplier: true, requestedBy: true } });
    await this.notifications.notifyOrg(updated.buyerId, { type: 'access_request.declined', title: `${updated.supplier.name} declined your passport request`, message: 'You can ask again later or start a vendor check instead.', link: '/buyer/checks' });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'access_request.decline', entity: 'access_request', entityId: id });
    return this.toView(updated);
  }

  private async loadForSupplier(user: RequestUser, id: string) {
    const req = await this.prisma.accessRequest.findUnique({ where: { id }, include: { buyer: true } });
    if (!req) throw AppException.notFound('Access request');
    if (req.supplierId !== user.organizationId || user.organizationType !== OrganizationType.SUPPLIER) throw AppException.forbidden();
    if (req.status !== AccessRequestStatus.PENDING) throw AppException.conflict('This request has already been answered');
    return req;
  }

  private toView(r: { id: string; buyerId: string; supplierId: string; message: string | null; status: AccessRequestStatus; shareId: string | null; createdAt: Date; updatedAt: Date; buyer: { name: string }; supplier: { name: string }; requestedBy: { name: string; email: string } }) {
    return {
      id: r.id,
      buyerId: r.buyerId,
      buyerName: r.buyer.name,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      requestedBy: { name: r.requestedBy.name, email: r.requestedBy.email },
      requestedByName: r.requestedBy.name,
      message: r.message,
      status: r.status,
      shareId: r.shareId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
