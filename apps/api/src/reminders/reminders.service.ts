import { Injectable, Logger } from '@nestjs/common';
import { ReminderKind, VendorCheckStatus, docTypeLabel } from '@vp/shared';
import { addDays } from '../common/utils/dates';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const KINDS: Array<{ kind: ReminderKind; daysBefore: number }> = [
  { kind: ReminderKind.D60, daysBefore: 60 },
  { kind: ReminderKind.D30, daysBefore: 30 },
  { kind: ReminderKind.D7, daysBefore: 7 },
  { kind: ReminderKind.EXPIRED, daysBefore: 0 },
];

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfigService,
  ) {}

  /** Creates the 60/30/7-day and expiry reminders for a document (skipping ones already in the past). */
  async syncForDocument(documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) return;
    if (!doc.expiresAt || doc.supersededById) {
      await this.prisma.reminder.deleteMany({ where: { documentId, sentAt: null } });
      return;
    }
    const cutoff = addDays(new Date(), -1);
    for (const { kind, daysBefore } of KINDS) {
      const dueAt = addDays(doc.expiresAt, -daysBefore);
      if (dueAt < cutoff) {
        await this.prisma.reminder.deleteMany({ where: { documentId, kind, sentAt: null } });
        continue;
      }
      await this.prisma.reminder.upsert({
        where: { documentId_kind: { documentId, kind } },
        create: { documentId, kind, dueAt },
        update: { dueAt },
      });
    }
  }

  /** Sends every due reminder. Returns how many were sent. */
  async sendDue(now = new Date()): Promise<number> {
    const due = await this.prisma.reminder.findMany({
      where: { sentAt: null, dueAt: { lte: now } },
      include: { document: { include: { supplier: true } } },
      take: 200,
    });
    let sent = 0;
    for (const reminder of due) {
      const doc = reminder.document;
      if (doc.supersededById) {
        await this.prisma.reminder.delete({ where: { id: reminder.id } });
        continue;
      }
      const label = doc.docType ? docTypeLabel(doc.docType) : doc.fileName;
      const expiresOn = doc.expiresAt?.toISOString().slice(0, 10) ?? '';
      const link = `/supplier/documents/${doc.id}`;
      const expired = reminder.kind === ReminderKind.EXPIRED;
      await this.notifications.notifyOrg(doc.supplierId, {
        type: expired ? 'document.expired' : 'document.expiring',
        title: expired ? `${label} has expired` : `${label} expires ${describe(reminder.kind as ReminderKind)}`,
        message: expired
          ? `${label} (${doc.fileName}) expired on ${expiresOn}. Upload the renewed document to keep your passport current.`
          : `${label} (${doc.fileName}) expires on ${expiresOn}. Upload the renewed document before then.`,
        link,
        email: true,
      });
      if (expired) await this.notifyBuyers(doc.supplierId, doc.supplier.name, label, expiresOn);
      await this.prisma.reminder.update({ where: { id: reminder.id }, data: { sentAt: now } });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`Sent ${sent} reminder(s)`);
    return sent;
  }

  /** Buyers holding a share or an open check rely on this document. */
  async notifyBuyers(supplierId: string, supplierName: string, label: string, dateText: string, renewed = false): Promise<void> {
    const [shares, checks] = await Promise.all([
      this.prisma.passportShare.findMany({ where: { passport: { supplierId }, revokedAt: null, buyerId: { not: null } }, select: { buyerId: true } }),
      this.prisma.vendorCheck.findMany({ where: { supplierId, status: { in: [VendorCheckStatus.DRAFT, VendorCheckStatus.IN_REVIEW, VendorCheckStatus.MORE_INFO] } }, select: { buyerId: true, id: true } }),
    ]);
    const buyerIds = new Set<string>([...shares.map((s) => s.buyerId as string), ...checks.map((c) => c.buyerId)]);
    for (const buyerId of buyerIds) {
      const check = checks.find((c) => c.buyerId === buyerId);
      await this.notifications.notifyOrg(buyerId, {
        type: renewed ? 'supplier.document.renewed' : 'supplier.document.expired',
        title: renewed ? `${supplierName} renewed their ${label}` : `${supplierName}: ${label} expired`,
        message: renewed ? `${supplierName} uploaded a new ${label}. Their passport and trust score were updated.` : `${supplierName}'s ${label} expired on ${dateText}. Their trust score was updated.`,
        link: check ? `/buyer/checks/${check.id}` : null,
      });
    }
  }
}

function describe(kind: ReminderKind): string {
  return { D60: 'in 60 days', D30: 'in 30 days', D7: 'in 7 days', EXPIRED: 'today' }[kind];
}
