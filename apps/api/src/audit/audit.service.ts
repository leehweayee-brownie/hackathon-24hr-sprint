import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Paginated, PaginationQuery } from '../common/dto/pagination';
import { PrismaService } from '../database/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /** Writes an audit record. Never throws: auditing must not break the request. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          organizationId: entry.organizationId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for ${entry.action}: ${(err as Error).message}`);
    }
  }

  async list(filter: { organizationId?: string; entity?: string; entityId?: string }, query: PaginationQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
      ...(filter.entity ? { entity: filter.entity } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return Paginated.of(
      items.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        metadata: a.metadata,
        actorId: a.actorId,
        actorName: a.actor?.name ?? null,
        actor: a.actor,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }
}
