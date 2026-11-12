import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DOC_TYPE_DEFINITIONS, DocumentStatus } from '@vp/shared';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/config.service';
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
    private readonly config: AppConfigService,
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

  async aiUsage() {
    const [totals, cachedCalls, perDay, perSupplier, perModel] = await Promise.all([
      this.prisma.aiUsage.aggregate({ _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costUsd: true, durationMs: true } }),
      this.prisma.aiUsage.count({ where: { cached: true } }),
      this.prisma.$queryRaw<Array<{ day: Date; calls: bigint; input_tokens: bigint; output_tokens: bigint; cost_usd: Prisma.Decimal }>>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS calls, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(cost_usd) AS cost_usd
        FROM ai_usage GROUP BY 1 ORDER BY 1 DESC LIMIT 30`,
      this.prisma.aiUsage.groupBy({ by: ['supplierId'], _count: { _all: true }, _sum: { costUsd: true, inputTokens: true, outputTokens: true } }),
      this.prisma.aiUsage.groupBy({ by: ['model', 'cached'], _count: { _all: true }, _sum: { costUsd: true } }),
    ]);
    const supplierIds = perSupplier.map((s) => s.supplierId).filter((x): x is string => !!x);
    const suppliers = await this.prisma.organization.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } });
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    const checks = await this.prisma.vendorCheck.count();
    const totalCost = Number(totals._sum.costUsd ?? 0);
    const byDay = perDay.map((d) => ({ day: d.day.toISOString().slice(0, 10), calls: Number(d.calls), inputTokens: Number(d.input_tokens), outputTokens: Number(d.output_tokens), costUsd: Number(d.cost_usd) }));
    const bySupplier = perSupplier.map((s) => ({ supplierId: s.supplierId, supplierName: s.supplierId ? names.get(s.supplierId) ?? 'Unknown' : 'Unknown', calls: s._count._all, costUsd: Number(s._sum.costUsd ?? 0), inputTokens: s._sum.inputTokens ?? 0, outputTokens: s._sum.outputTokens ?? 0 }));
    return {
      model: this.config.get('AI_PROVIDER') === 'anthropic' ? this.config.get('AI_MODEL') : 'mock (recorded extractions)',
      totals: {
        calls: totals._count._all,
        cached: cachedCalls,
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        costUsd: totalCost,
        avgDurationMs: totals._count._all ? Math.round((totals._sum.durationMs ?? 0) / totals._count._all) : 0,
        costPerCheckUsd: checks ? totalCost / checks : 0,
      },
      byDay,
      bySupplier,
      byModel: perModel.map((m) => ({ model: m.model, cached: m.cached, calls: m._count._all, costUsd: Number(m._sum.costUsd ?? 0) })),
    };
  }

  runReminders() {
    return this.reminders.sendDue().then((sent) => ({ sent }));
  }
}
