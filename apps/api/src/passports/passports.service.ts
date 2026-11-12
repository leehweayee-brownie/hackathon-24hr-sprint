import { HttpStatus, Injectable } from '@nestjs/common';
import type { Document, Organization, Passport } from '@prisma/client';
import { DocType, DocumentStatus, ErrorCode, OrganizationType, PassportShareView, PassportStatus, PassportView, UserRole } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { randomUUID } from 'node:crypto';
import { hmac, sha256 } from '../common/utils/crypto';
import { addDays } from '../common/utils/dates';
import { AppConfigService } from '../config/config.service';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { effectiveValue, toDocumentView } from '../documents/document.mapper';
import { DocumentsService } from '../documents/documents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { CreateShareDto } from './dto/passports.dto';

type ShareWithRelations = Awaited<ReturnType<PassportsService['findShareByToken']>>;

@Injectable()
export class PassportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly organizations: OrganizationsService,
    private readonly crossCheck: CrossCheckService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async ensurePassport(supplierId: string): Promise<Passport> {
    return this.prisma.passport.upsert({ where: { supplierId }, create: { supplierId }, update: {} });
  }

  /** Full passport view for a supplier (used by the owner, buyers with access and public share links). */
  async view(supplierId: string): Promise<PassportView> {
    const [supplier, passport, settings, ruleDocs] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: supplierId } }),
      this.ensurePassport(supplierId),
      this.organizations.resolveSettings(supplierId),
      this.crossCheck.buildRuleDocuments(supplierId),
    ]);
    if (!supplier) throw AppException.notFound('Supplier');
    const docs = await this.prisma.document.findMany({
      where: { supplierId, supersededById: null },
      include: { fields: { include: { confirmedBy: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const findings = await this.crossCheck.findings(supplierId, null);
    return {
      id: passport.id,
      supplierId,
      supplierName: supplier.name,
      registrationNo: supplier.registrationNo,
      trustScore: passport.trustScore,
      band: passport.trustScore >= 80 ? 'green' : passport.trustScore >= 60 ? 'amber' : 'red',
      status: passport.status as PassportStatus,
      verifiedAt: passport.verifiedAt?.toISOString() ?? null,
      updatedAt: passport.updatedAt.toISOString(),
      findings,
      documents: docs.map((d) => toDocumentView(d, settings.confidenceThreshold)),
      timeline: this.crossCheck.timeline(ruleDocs, settings),
      companyDetails: companyDetails(supplier, docs),
    };
  }

  async own(user: RequestUser): Promise<PassportView> {
    if (user.organizationType !== OrganizationType.SUPPLIER) throw AppException.forbidden('Only suppliers have a passport');
    return this.view(user.organizationId);
  }

  async createShare(user: RequestUser, dto: CreateShareDto): Promise<PassportShareView> {
    if (user.organizationType !== OrganizationType.SUPPLIER) throw AppException.forbidden('Only suppliers share passports');
    const passport = await this.ensurePassport(user.organizationId);
    const id = randomUUID();
    const token = this.tokenFor(id);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : dto.expiresInDays ? addDays(new Date(), dto.expiresInDays) : null;
    const share = await this.prisma.passportShare.create({
      data: {
        id,
        passportId: passport.id,
        tokenHash: sha256(token),
        buyerId: dto.buyerId ?? null,
        label: dto.label?.trim() || null,
        createdById: user.id,
        expiresAt,
      },
      include: { buyer: { select: { name: true } } },
    });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'passport.share.create', entity: 'passport_share', entityId: share.id, metadata: { label: share.label, buyerId: share.buyerId } });
    if (share.buyerId) {
      await this.notifications.notifyOrg(share.buyerId, {
        type: 'passport.shared',
        title: `${user.organizationName} shared their Vendor Passport with you`,
        message: 'Open the passport to see their documents, trust score and expiry timeline.',
        link: `/p/${token}`,
      });
    }
    return { ...this.toShareView(share), token, url: this.shareUrl(token) };
  }

  async listShares(user: RequestUser): Promise<PassportShareView[]> {
    const passport = await this.ensurePassport(user.organizationId);
    const shares = await this.prisma.passportShare.findMany({ where: { passportId: passport.id }, include: { buyer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    return shares.map((s) => this.toShareView(s));
  }

  async revokeShare(user: RequestUser, id: string): Promise<PassportShareView> {
    const share = await this.prisma.passportShare.findFirst({ where: { id, passport: { supplierId: user.organizationId } }, include: { buyer: { select: { name: true } } } });
    if (!share) throw AppException.notFound('Share link');
    const updated = await this.prisma.passportShare.update({ where: { id }, data: { revokedAt: share.revokedAt ?? new Date() }, include: { buyer: { select: { name: true } } } });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'passport.share.revoke', entity: 'passport_share', entityId: id });
    return this.toShareView(updated);
  }

  async shareViews(user: RequestUser, id: string) {
    const share = await this.prisma.passportShare.findFirst({ where: { id, passport: { supplierId: user.organizationId } } });
    if (!share) throw AppException.notFound('Share link');
    const views = await this.prisma.passportShareView.findMany({ where: { shareId: id }, orderBy: { viewedAt: 'desc' }, take: 200, include: { viewer: { select: { name: true, organization: { select: { name: true } } } } } });
    return views.map((v) => ({
      id: v.id,
      viewedAt: v.viewedAt.toISOString(),
      viewerName: v.viewer?.name ?? null,
      viewerOrganization: v.viewer?.organization.name ?? null,
      viewerIp: v.viewerIp,
      userAgent: v.userAgent,
    }));
  }

  /** Public: resolves a share token, records the view and returns the passport. */
  async viewByToken(token: string, meta: { ip?: string; userAgent?: string; viewerUserId?: string | null }): Promise<PassportView & { share: { label: string | null; expiresAt: string | null } }> {
    const share = await this.findShareByToken(token);
    await this.prisma.$transaction([
      this.prisma.passportShareView.create({ data: { shareId: share.id, viewerIp: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null, viewerUserId: meta.viewerUserId ?? null } }),
      this.prisma.passportShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } }),
    ]);
    await this.audit.log({ actorId: meta.viewerUserId ?? null, organizationId: share.passport.supplierId, action: 'passport.view', entity: 'passport_share', entityId: share.id, ip: meta.ip });
    return { ...(await this.view(share.passport.supplierId)), share: { label: share.label, expiresAt: share.expiresAt?.toISOString() ?? null } };
  }

  async fileByToken(token: string, documentId: string) {
    const share = await this.findShareByToken(token);
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, supplierId: share.passport.supplierId } });
    if (!doc) throw AppException.notFound('Document');
    return this.documents.signedUrlFor(doc);
  }

  async findShareByToken(token: string) {
    const share = await this.prisma.passportShare.findUnique({ where: { tokenHash: sha256(token) }, include: { passport: true } });
    if (!share) throw AppException.notFound('Share link');
    if (share.revokedAt) throw new AppException(ErrorCode.SHARE_LINK_REVOKED, 'This passport link has been revoked', HttpStatus.GONE);
    if (share.expiresAt && share.expiresAt < new Date()) throw new AppException(ErrorCode.SHARE_LINK_EXPIRED, 'This passport link has expired', HttpStatus.GONE);
    return share;
  }

  /** Buyers may read a passport directly (no token) when they hold a share or a vendor check with the supplier. */
  async viewAsBuyer(user: RequestUser, supplierId: string): Promise<PassportView> {
    if (user.role !== UserRole.ADMIN && user.organizationId !== supplierId) {
      const [check, share] = await Promise.all([
        this.prisma.vendorCheck.findFirst({ where: { buyerId: user.organizationId, supplierId } }),
        this.prisma.passportShare.findFirst({ where: { buyerId: user.organizationId, revokedAt: null, passport: { supplierId } } }),
      ]);
      if (!check && !share) throw AppException.forbidden('No vendor check or share with this supplier');
    }
    return this.view(supplierId);
  }

  shareUrl(token: string): string {
    return `${this.config.get('WEB_URL').replace(/\/$/, '')}/p/${token}`;
  }

  /**
   * Share tokens are derived from the share id with a server secret, so the link can be shown again later
   * while the database only holds its hash. Tokens created elsewhere (e.g. the seed) cannot be re-derived.
   */
  private tokenFor(shareId: string): string {
    return hmac(this.config.get('SHARE_TOKEN_SECRET') as string, `share:${shareId}`);
  }

  private urlFor(share: { id: string; tokenHash: string }): string {
    const token = this.tokenFor(share.id);
    return sha256(token) === share.tokenHash ? this.shareUrl(token) : '';
  }

  private toShareView(s: { id: string; passportId: string; tokenHash: string; buyerId: string | null; label: string | null; expiresAt: Date | null; revokedAt: Date | null; lastViewedAt: Date | null; viewCount: number; createdAt: Date; buyer?: { name: string } | null }): PassportShareView {
    return {
      id: s.id,
      passportId: s.passportId,
      url: this.urlFor(s),
      buyerId: s.buyerId,
      buyerName: s.buyer?.name ?? null,
      label: s.label,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      revokedAt: s.revokedAt?.toISOString() ?? null,
      lastViewedAt: s.lastViewedAt?.toISOString() ?? null,
      viewCount: s.viewCount,
      createdAt: s.createdAt.toISOString(),
    };
  }
}

/** Company details come from the SSM certificate, falling back to the organization record. */
export function companyDetails(supplier: Organization, docs: Array<Document & { fields: Array<{ key: string; rawValue: string | null; normalizedValue: string | null; correctedValue: string | null }> }>): Record<string, string | null> {
  const ssm = docs.find((d) => d.docType === DocType.SSM && [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW].includes(d.status as DocumentStatus));
  const cidb = docs.find((d) => d.docType === DocType.CIDB && [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW].includes(d.status as DocumentStatus));
  const get = (doc: typeof ssm, key: string, raw = false) => {
    const f = doc?.fields.find((x) => x.key === key);
    return f ? (raw ? f.correctedValue ?? f.rawValue : effectiveValue(f)) : null;
  };
  return {
    companyName: get(ssm, 'company_name', true) ?? supplier.name,
    registrationNo: get(ssm, 'registration_no', true) ?? supplier.registrationNo,
    incorporationDate: get(ssm, 'incorporation_date'),
    registeredAddress: get(ssm, 'registered_address', true),
    companyStatus: get(ssm, 'company_status', true),
    cidbGrade: get(cidb, 'grade'),
    cidbCategories: get(cidb, 'categories'),
    cidbRegistrationNo: get(cidb, 'cidb_registration_no', true),
  };
}
