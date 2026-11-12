import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DOC_TYPE_DEFINITIONS, DocumentStatus } from '@vp/shared';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service';
import { Paginated, PaginationQuery } from '../common/dto/pagination';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { REDIS_CLIENT } from '../database/redis.provider';
import { DOCUMENTS_QUEUE } from '../intake/documents.queue';
import { OrganizationsService, SYSTEM_RULES_KEY, sanitizeWeights } from '../organizations/organizations.service';
import { RemindersService } from '../reminders/reminders.service';
import type { UpdateRulesDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly crossCheck: CrossCheckService,
    private readonly reminders: RemindersService,
    private readonly audit: AuditService,
    @InjectQueue(DOCUMENTS_QUEUE) private readonly queue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async organizations_(query: PaginationQuery) {
    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: { _count: { select: { users: true, documents: true } }, passport: { select: { trustScore: true, status: true } }, users: { select: { id: true, name: true, email: true, role: true, suspendedAt: true, emailVerifiedAt: true, createdAt: true } } },
      }),
      this.prisma.organization.count(),
    ]);
    return Paginated.of(
      rows.map((o) => ({
        id: o.id,
        type: o.type,
        name: o.name,
        registrationNo: o.registrationNo,
        settings: o.settings,
        userCount: o._count.users,
        documentCount: o._count.documents,
        trustScore: o.passport?.trustScore ?? null,
        passportStatus: o.passport?.status ?? null,
        createdAt: o.createdAt.toISOString(),
        users: o.users.map((u) => ({ ...u, suspendedAt: u.suspendedAt?.toISOString() ?? null, emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() })),
      })),
      total,
      query,
    );
  }

  async suspendUser(admin: RequestUser, id: string, suspended: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw AppException.notFound('User');
    if (user.id === admin.id) throw AppException.conflict('You cannot suspend yourself');
    const updated = await this.prisma.user.update({ where: { id }, data: { suspendedAt: suspended ? (user.suspendedAt ?? new Date()) : null } });
    if (suspended) await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: admin.id, organizationId: admin.organizationId, action: suspended ? 'admin.user.suspend' : 'admin.user.unsuspend', entity: 'user', entityId: id });
    return { id: updated.id, email: updated.email, suspendedAt: updated.suspendedAt?.toISOString() ?? null };
  }

  async deleteUser(admin: RequestUser, id: string) {
    if (id === admin.id) throw AppException.conflict('You cannot delete yourself');
    await this.prisma.user.delete({ where: { id } });
    await this.audit.log({ actorId: admin.id, organizationId: admin.organizationId, action: 'admin.user.delete', entity: 'user', entityId: id });
    return { deleted: true };
  }

  documentTypes() {
    return Object.values(DOC_TYPE_DEFINITIONS);
  }

  /** `{ weights, confidenceThreshold, expiryWarningDays, minLiabilityCoverage, approverThreshold }` */
  async rules() {
    const { ruleWeights, ...rest } = await this.organizations.systemDefaults();
    return { ...rest, weights: ruleWeights };
  }

  async updateRules(admin: RequestUser, dto: UpdateRulesDto) {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: SYSTEM_RULES_KEY } });
    const current = (row?.value ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    for (const key of ['confidenceThreshold', 'expiryWarningDays', 'minLiabilityCoverage', 'approverThreshold'] as const) {
      if (dto[key] !== undefined) next[key] = dto[key];
    }
    const weights = dto.weights ?? dto.ruleWeights;
    if (weights) next.ruleWeights = { ...((current.ruleWeights as object) ?? {}), ...sanitizeWeights(weights) };
    await this.prisma.systemSetting.upsert({ where: { key: SYSTEM_RULES_KEY }, create: { key: SYSTEM_RULES_KEY, value: next as Prisma.InputJsonValue }, update: { value: next as Prisma.InputJsonValue } });
    await this.audit.log({ actorId: admin.id, organizationId: admin.organizationId, action: 'admin.rules.update', entity: 'system_setting', entityId: SYSTEM_RULES_KEY, metadata: next });
    const suppliers = await this.prisma.organization.findMany({ where: { type: 'SUPPLIER' }, select: { id: true } });
    for (const s of suppliers) await this.crossCheck.recomputeForSupplier(s.id);
    return this.rules();
  }

  async queue_() {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    const [failedDocuments, inProgress, byStatus] = await Promise.all([
      this.prisma.document.findMany({ where: { status: DocumentStatus.FAILED }, orderBy: { updatedAt: 'desc' }, take: 20, include: { supplier: { select: { name: true } } } }),
      this.prisma.document.count({ where: { status: { in: [DocumentStatus.UPLOADED, DocumentStatus.CONVERTING, DocumentStatus.CLASSIFYING, DocumentStatus.EXTRACTING] } } }),
      this.prisma.document.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const redis = await this.redis.ping().then(() => 'up' as const).catch(() => 'down' as const);
    return {
      queue: DOCUMENTS_QUEUE,
      redis,
      counts,
      inProgress,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      failedDocuments: failedDocuments.map((d) => ({ id: d.id, fileName: d.fileName, supplierId: d.supplierId, supplierName: d.supplier.name, error: d.error, attempts: d.attempts, updatedAt: d.updatedAt.toISOString() })),
    };
  }

  runReminders() {
    return this.reminders.sendDue().then((sent) => ({ sent }));
  }
}
