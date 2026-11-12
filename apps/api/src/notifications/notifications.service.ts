import { Injectable } from '@nestjs/common';
import type { NotificationView } from '@vp/shared';
import { Paginated, PaginationQuery } from '../common/dto/pagination';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../database/prisma.service';
import { MailService } from './mail.service';

export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string | null;
  /** Also send an email (logged in development). */
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async notifyUser(userId: string, input: NotificationInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.suspendedAt) return;
    await this.prisma.notification.create({
      data: { userId, type: input.type, title: input.title, message: input.message, link: input.link ?? null },
    });
    if (input.email) await this.mail.send({ to: user.email, subject: input.title, text: input.message });
  }

  /** Notifies every active user in an organization. */
  async notifyOrg(organizationId: string, input: NotificationInput): Promise<void> {
    const users = await this.prisma.user.findMany({ where: { organizationId, suspendedAt: null } });
    if (users.length === 0) return;
    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type: input.type, title: input.title, message: input.message, link: input.link ?? null })),
    });
    if (input.email) {
      await Promise.all(users.map((u) => this.mail.send({ to: u.email, subject: input.title, text: input.message })));
    }
  }

  async list(userId: string, query: PaginationQuery, unreadOnly = false): Promise<Paginated<NotificationView>> {
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.notification.count({ where }),
    ]);
    return Paginated.of(items.map(toView), total, query);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<NotificationView> {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw AppException.notFound('Notification');
    const updated = await this.prisma.notification.update({ where: { id }, data: { readAt: n.readAt ?? new Date() } });
    return toView(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: res.count };
  }
}

function toView(n: { id: string; type: string; title: string; message: string; link: string | null; readAt: Date | null; createdAt: Date }): NotificationView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
