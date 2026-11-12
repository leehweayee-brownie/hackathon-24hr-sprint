import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, VendorCheck } from '@prisma/client';
import { EvaluationResult, RuleDocument, buildTimeline, evaluate } from '@vp/rules';
import { DocType, DocumentStatus, Finding, FindingsUpdatedEvent, SOCKET_EVENTS, TimelineEntry, VendorCheckStatus } from '@vp/shared';
import { effectiveValue } from '../documents/document.mapper';
import { toIsoDate } from '../common/utils/dates';
import { PrismaService } from '../database/prisma.service';
import { OrganizationsService, ResolvedSettings } from '../organizations/organizations.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { TrustScoreService } from '../trust-score/trust-score.service';

const OPEN_CHECK_STATUSES: VendorCheckStatus[] = [VendorCheckStatus.DRAFT, VendorCheckStatus.IN_REVIEW, VendorCheckStatus.MORE_INFO];

/** Turns the supplier's documents into rules-engine input and keeps findings and scores up to date. */
@Injectable()
export class CrossCheckService {
  private readonly logger = new Logger(CrossCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly trustScore: TrustScoreService,
    private readonly realtime: RealtimePublisher,
  ) {}

  async buildRuleDocuments(supplierId: string): Promise<RuleDocument[]> {
    const docs = await this.prisma.document.findMany({ where: { supplierId }, include: { fields: true }, orderBy: { createdAt: 'asc' } });
    return docs.map((d) => ({
      id: d.id,
      docType: (d.docType as DocType | null) ?? DocType.OTHER,
      status: d.status as DocumentStatus,
      fileName: d.fileName,
      issuedAt: toIsoDate(d.issuedAt),
      expiresAt: toIsoDate(d.expiresAt),
      supersededById: d.supersededById,
      fields: Object.fromEntries(d.fields.map((f) => [f.key, { value: effectiveValue(f), confidence: f.confidence, confirmed: f.confirmedAt !== null }])),
    }));
  }

  evaluateSupplier(docs: RuleDocument[], settings: ResolvedSettings, now = new Date()): EvaluationResult {
    return evaluate({
      documents: docs,
      now,
      weights: settings.ruleWeights,
      confidenceThreshold: settings.confidenceThreshold,
      expiryWarningDays: settings.expiryWarningDays,
      minLiabilityCoverage: settings.minLiabilityCoverage,
    });
  }

  evaluateCheck(docs: RuleDocument[], check: Pick<VendorCheck, 'contractValue' | 'requiredDocTypes'>, settings: ResolvedSettings, now = new Date()): EvaluationResult {
    return evaluate({
      documents: docs,
      now,
      contractValue: Number(check.contractValue),
      requiredDocTypes: check.requiredDocTypes as DocType[],
      minLiabilityCoverage: settings.minLiabilityCoverage,
      weights: settings.ruleWeights,
      confidenceThreshold: settings.confidenceThreshold,
      expiryWarningDays: settings.expiryWarningDays,
    });
  }

  timeline(docs: RuleDocument[], settings: ResolvedSettings, now = new Date()): TimelineEntry[] {
    return buildTimeline(docs.filter((d) => [DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW].includes(d.status)), now, settings.expiryWarningDays);
  }

  private readonly inFlight = new Map<string, Promise<FindingsUpdatedEvent>>();

  /**
   * Recomputes supplier-level findings, the passport score and every open vendor check for the supplier.
   * Runs are serialized per supplier (in-process queue + Postgres advisory lock) so parallel document jobs
   * never interleave their delete/insert of findings.
   */
  recomputeForSupplier(supplierId: string): Promise<FindingsUpdatedEvent> {
    const previous = this.inFlight.get(supplierId) ?? Promise.resolve(undefined as unknown as FindingsUpdatedEvent);
    const run = previous.catch(() => undefined).then(() => this.recomputeNow(supplierId));
    this.inFlight.set(supplierId, run);
    run.finally(() => {
      if (this.inFlight.get(supplierId) === run) this.inFlight.delete(supplierId);
    }).catch(() => undefined);
    return run;
  }

  private async recomputeNow(supplierId: string): Promise<FindingsUpdatedEvent> {
    const [docs, settings] = await Promise.all([this.buildRuleDocuments(supplierId), this.organizations.resolveSettings(supplierId)]);
    const result = this.evaluateSupplier(docs, settings);
    await this.replaceFindings(supplierId, null, result.findings);
    const verifiedDocuments = docs.filter((d) => d.status === DocumentStatus.VERIFIED && !d.supersededById && d.docType !== DocType.OTHER).length;
    await this.trustScore.applyToPassport(supplierId, result.score, result.findings, verifiedDocuments);

    const checks = await this.prisma.vendorCheck.findMany({ where: { supplierId, status: { in: OPEN_CHECK_STATUSES } } });
    for (const check of checks) await this.recomputeCheck(check, docs);

    const event: FindingsUpdatedEvent = { supplierId, findings: result.findings, trustScore: result.score, band: result.band };
    await this.realtime.toSupplier(supplierId, SOCKET_EVENTS.findingsUpdated, event).catch((err) => this.logger.warn(`Realtime publish failed: ${(err as Error).message}`));
    return event;
  }

  async recomputeCheck(check: VendorCheck, docs?: RuleDocument[]): Promise<EvaluationResult> {
    const ruleDocs = docs ?? (await this.buildRuleDocuments(check.supplierId));
    const settings = await this.organizations.resolveSettings(check.buyerId);
    const result = this.evaluateCheck(ruleDocs, check, settings);
    await this.replaceFindings(check.supplierId, check.id, result.findings);
    await this.prisma.vendorCheck.update({ where: { id: check.id }, data: { trustScore: result.score } });
    return result;
  }

  private async replaceFindings(supplierId: string, vendorCheckId: string | null, findings: Finding[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`findings:${supplierId}:${vendorCheckId ?? 'supplier'}`}))`;
      await tx.finding.deleteMany({ where: { supplierId, vendorCheckId } });
      await tx.finding.createMany({
        data: findings.map(
          (f): Prisma.FindingCreateManyInput => ({
            supplierId,
            vendorCheckId,
            rule: f.rule,
            severity: f.severity,
            message: f.message,
            deduction: f.deduction,
            documentIds: f.documentIds,
            meta: (f.meta ?? undefined) as Prisma.InputJsonValue | undefined,
          }),
        ),
      });
    });
  }

  async findings(supplierId: string, vendorCheckId: string | null): Promise<Finding[]> {
    const rows = await this.prisma.finding.findMany({ where: { supplierId, vendorCheckId }, orderBy: [{ severity: 'asc' }, { deduction: 'desc' }] });
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
    return rows
      .map((r) => ({ rule: r.rule as Finding['rule'], severity: r.severity as Finding['severity'], message: r.message, deduction: r.deduction, documentIds: r.documentIds, meta: (r.meta ?? undefined) as Finding['meta'] }))
      .sort((a, b) => order[a.severity] - order[b.severity] || b.deduction - a.deduction);
  }
}
