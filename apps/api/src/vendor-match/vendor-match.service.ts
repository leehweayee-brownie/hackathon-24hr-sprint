import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { compareMatches, matchSupplier, minGradeForValue, shortMyr } from '@vp/rules';
import {
  DEFAULT_REQUIRED_DOC_TYPES,
  DOC_TYPE_DEFINITIONS,
  DocType,
  ErrorCode,
  OrganizationType,
  UserRole,
  VendorCheckStatus,
  type BriefParseResult,
  type MatchResult,
  type TenderRequirements,
  type VendorCheckView,
  type VendorMatch,
} from '@vp/shared';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import type { UploadedFile } from '../documents/documents.service';
import { EXTRACTION_PROVIDER, type ExtractionProvider } from '../extraction/extraction-provider.interface';
import { PagePrepService } from '../extraction/page-prep.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RequestInfoDto } from '../vendor-checks/dto/vendor-checks.dto';
import { VendorChecksService } from '../vendor-checks/vendor-checks.service';
import { briefPrompt, parseBrief, tenderRequirementsSchema } from './brief-parser';

const OPEN: VendorCheckStatus[] = [VendorCheckStatus.DRAFT, VendorCheckStatus.IN_REVIEW, VendorCheckStatus.MORE_INFO];

/**
 * Vendor Match: brief → confirmed requirements → ranked shortlist with reasons → invite.
 * The AI only drafts the requirements. The rules engine decides fit; ratings and past jobs decide rank.
 */
@Injectable()
export class VendorMatchService {
  private readonly logger = new Logger(VendorMatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossCheck: CrossCheckService,
    private readonly organizations: OrganizationsService,
    private readonly checks: VendorChecksService,
    private readonly pagePrep: PagePrepService,
    private readonly audit: AuditService,
    @Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider,
  ) {}

  /** Drafts requirements from pasted text, quick fields (sent as text) or an uploaded RFQ. */
  async parseBrief(user: RequestUser, text: string | undefined, file: UploadedFile | undefined): Promise<BriefParseResult> {
    this.assertBuyer(user);
    const brief = text?.trim() ?? '';
    if (!brief && !file) throw new AppException(ErrorCode.VALIDATION_FAILED, 'Paste the brief, fill the quick fields or upload the RFQ', HttpStatus.BAD_REQUEST);
    const settings = await this.organizations.resolveSettings(user.organizationId);
    const fallback = parseBrief(brief, { minLiabilityCoverage: settings.minLiabilityCoverage });

    if (!this.provider.completeJson) {
      if (!brief) throw new AppException(ErrorCode.VALIDATION_FAILED, 'Reading an RFQ file needs the AI provider. Paste the brief text instead.', HttpStatus.UNPROCESSABLE_ENTITY);
      return fallback;
    }

    try {
      const input = file
        ? await this.pagePrep.prepare(file.buffer, file.mimetype, file.originalname, createHash('sha256').update(file.buffer).digest('hex'))
        : undefined;
      const raw = await this.provider.completeJson(briefPrompt(brief || null), input);
      const ai = tenderRequirementsSchema.parse(normalizeAi(raw));
      const assumptions: string[] = [];
      const requirements: TenderRequirements = {
        ...ai,
        requiredDocTypes: Array.from(new Set([...DEFAULT_REQUIRED_DOC_TYPES, ...ai.requiredDocTypes])),
      };
      if (!requirements.minCidbGrade && requirements.contractValue) {
        requirements.minCidbGrade = minGradeForValue(requirements.contractValue);
        if (requirements.minCidbGrade) assumptions.push(`CIDB ${requirements.minCidbGrade} or higher, derived from ${shortMyr(requirements.contractValue)}`);
      }
      if (requirements.minLiabilityCoverage === null && settings.minLiabilityCoverage) {
        requirements.minLiabilityCoverage = settings.minLiabilityCoverage;
        assumptions.push(`Public liability ≥ ${shortMyr(settings.minLiabilityCoverage)} from your organisation settings`);
      }
      return { requirements, source: 'ai', assumptions };
    } catch (err) {
      this.logger.warn(`AI could not read the brief, using the built-in parser: ${(err as Error).message}`);
      if (!brief) throw new AppException(ErrorCode.EXTRACTION_FAILED, 'Could not read the RFQ. Paste the brief text instead.', HttpStatus.UNPROCESSABLE_ENTITY);
      return fallback;
    }
  }

  /** Ranks every supplier with a passport against the confirmed requirements. */
  async shortlist(user: RequestUser, input: unknown): Promise<MatchResult> {
    this.assertBuyer(user);
    const requirements = this.validate(input);
    const suppliers = await this.prisma.organization.findMany({
      where: { type: OrganizationType.SUPPLIER, passport: { isNot: null }, documents: { some: { supersededById: null } } },
      select: { id: true, name: true, passport: { select: { trustScore: true } } },
    });
    const ids = suppliers.map((s) => s.id);
    const [ratings, approved, open] = await Promise.all([
      this.prisma.vendorRating.groupBy({ by: ['supplierId'], where: { supplierId: { in: ids } }, _avg: { score: true }, _count: { _all: true } }),
      this.prisma.vendorCheck.groupBy({ by: ['supplierId'], where: { supplierId: { in: ids }, status: VendorCheckStatus.APPROVED }, _count: { _all: true } }),
      this.prisma.vendorCheck.findMany({ where: { buyerId: user.organizationId, supplierId: { in: ids }, status: { in: OPEN }, tenderTitle: requirements.title }, select: { id: true, supplierId: true } }),
    ]);

    const matches: VendorMatch[] = await Promise.all(
      suppliers.map(async (s) => {
        const documents = await this.crossCheck.buildRuleDocuments(s.id);
        const r = ratings.find((x) => x.supplierId === s.id);
        const rating = { average: r?._avg.score ? Math.round(r._avg.score * 10) / 10 : null, count: r?._count._all ?? 0 };
        const pastJobs = approved.find((x) => x.supplierId === s.id)?._count._all ?? 0;
        const m = matchSupplier({ documents, requirements, rating, pastJobs });
        return {
          supplierId: s.id,
          supplierName: s.name,
          fit: m.fit,
          summary: m.summary,
          strengths: m.strengths,
          gaps: m.gaps,
          trustScore: s.passport?.trustScore ?? null,
          cidbGrade: m.cidbGrade,
          liabilityCover: m.liabilityCover,
          rating,
          pastJobs,
          location: m.location,
          openCheckId: open.find((c) => c.supplierId === s.id)?.id ?? null,
        };
      }),
    );
    matches.sort(compareMatches);
    await this.audit.log({
      actorId: user.id,
      organizationId: user.organizationId,
      action: 'vendor_match.shortlist',
      entity: 'organization',
      entityId: user.organizationId,
      metadata: { title: requirements.title, contractValue: requirements.contractValue, qualified: matches.filter((m) => m.fit === 'qualified').length, pool: matches.length },
    });
    return { requirements, matches, poolSize: suppliers.length };
  }

  /** "Invite to tender": opens a vendor check for this supplier and tender, which notifies them. */
  async invite(user: RequestUser, supplierId: string, input: unknown): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const requirements = this.validate(input);
    return this.openCheck(user, supplierId, requirements);
  }

  /** "Request document": opens (or reuses) the check and asks the supplier for the missing documents. */
  async requestDocuments(user: RequestUser, supplierId: string, input: unknown, docTypes: DocType[], note?: string): Promise<VendorCheckView> {
    this.assertBuyer(user);
    const requirements = this.validate(input);
    const check = await this.openCheck(user, supplierId, requirements);
    const defs = docTypes.map((t) => DOC_TYPE_DEFINITIONS[t]).filter(Boolean);
    const labels = defs.map((d) => (/^[A-Z]{2}/.test(d.label) ? d.label : d.label.charAt(0).toLowerCase() + d.label.slice(1)));
    const list = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}` : labels[0];
    const validity = requirements.endDate && defs.some((d) => d.hasExpiry) ? `, valid until at least ${requirements.endDate}` : '';
    const message = note?.trim() || `To be considered for "${requirements.title}", please upload your ${list ?? 'missing documents'}${validity}.`;
    return this.checks.requestInfo(user, check.id, Object.assign(new RequestInfoDto(), { message }));
  }

  private async openCheck(user: RequestUser, supplierId: string, requirements: TenderRequirements): Promise<VendorCheckView> {
    const existing = await this.prisma.vendorCheck.findFirst({
      where: { buyerId: user.organizationId, supplierId, tenderTitle: requirements.title, status: { in: OPEN } },
      select: { id: true },
    });
    if (existing) return this.checks.get(user, existing.id);
    if (!requirements.contractValue) throw new AppException(ErrorCode.VALIDATION_FAILED, 'Add the contract value before inviting suppliers', HttpStatus.BAD_REQUEST);
    return this.checks.create(user, {
      supplierId,
      tenderTitle: requirements.title,
      contractValue: requirements.contractValue,
      requiredDocTypes: requirements.requiredDocTypes,
    });
  }

  private validate(input: unknown): TenderRequirements {
    const parsed = tenderRequirementsSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, `Requirements are incomplete: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`, HttpStatus.BAD_REQUEST);
    }
    return parsed.data as TenderRequirements;
  }

  private assertBuyer(user: RequestUser): void {
    if (user.organizationType !== OrganizationType.BUYER && user.role !== UserRole.ADMIN) throw AppException.forbidden('Only buyer officers can match vendors');
  }
}

/** Models sometimes send numbers as strings or omit arrays; tidy before strict validation. */
function normalizeAi(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const o = { ...(raw as Record<string, unknown>) };
  const num = (v: unknown) => (typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) || null : v ?? null);
  o.contractValue = num(o.contractValue);
  o.minLiabilityCoverage = num(o.minLiabilityCoverage);
  for (const k of ['location', 'startDate', 'endDate', 'minCidbGrade']) o[k] = o[k] === '' || o[k] === undefined ? null : o[k];
  if (typeof o.minCidbGrade === 'string') o.minCidbGrade = o.minCidbGrade.toUpperCase().replace(/\s/g, '');
  o.requiredDocTypes = Array.isArray(o.requiredDocTypes) ? o.requiredDocTypes.filter((d) => Object.values(DocType).includes(d as DocType)) : [];
  o.notes = Array.isArray(o.notes) ? o.notes.filter((n) => typeof n === 'string') : [];
  return o;
}
