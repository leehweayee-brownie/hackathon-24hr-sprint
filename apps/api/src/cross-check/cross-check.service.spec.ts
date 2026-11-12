import { Test } from '@nestjs/testing';
import { DEFAULT_RULE_WEIGHTS, DocType, DocumentStatus, RuleCode, SOCKET_EVENTS, Severity } from '@vp/shared';
import { PrismaService } from '../database/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { CrossCheckService } from './cross-check.service';

const settings = { confidenceThreshold: 0.85, expiryWarningDays: 30, minLiabilityCoverage: null, approverThreshold: 5_000_000, ruleWeights: DEFAULT_RULE_WEIGHTS };

interface FakeField { key: string; rawValue: string | null; normalizedValue: string | null; correctedValue: string | null; confidence: number; confirmedAt: Date | null }

function doc(id: string, docType: DocType, fields: Record<string, string | null>, extra: Partial<{ status: DocumentStatus; expiresAt: Date | null; supersededById: string | null; confidence: number }> = {}) {
  return {
    id, docType, fileName: `${id}.pdf`, status: extra.status ?? DocumentStatus.VERIFIED, supersededById: extra.supersededById ?? null,
    issuedAt: null, expiresAt: extra.expiresAt ?? null, createdAt: new Date(),
    fields: Object.entries(fields).map(([key, value]): FakeField => ({ key, rawValue: value, normalizedValue: value, correctedValue: null, confidence: extra.confidence ?? 0.95, confirmedAt: null })),
  };
}

describe('CrossCheckService', () => {
  let service: CrossCheckService;
  const findings: Array<{ supplierId: string; vendorCheckId: string | null; rule: string; severity: string; message: string; deduction: number }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    document: { findMany: jest.fn() },
    vendorCheck: { findMany: jest.fn(async () => []), update: jest.fn() },
    finding: {
      deleteMany: jest.fn(async ({ where }: { where: { supplierId: string; vendorCheckId: string | null } }) => {
        for (let i = findings.length - 1; i >= 0; i -= 1) if (findings[i].supplierId === where.supplierId && findings[i].vendorCheckId === where.vendorCheckId) findings.splice(i, 1);
      }),
      createMany: jest.fn(async ({ data }: { data: typeof findings }) => { findings.push(...data); }),
      findMany: jest.fn(async () => findings),
    },
    $transaction: jest.fn(async (arg: unknown) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[]))),
    $executeRaw: jest.fn(async () => 0),
  };
  const trustScore = { applyToPassport: jest.fn() };
  const realtime = { toSupplier: jest.fn(async () => undefined) };

  beforeEach(async () => {
    findings.length = 0;
    jest.clearAllMocks();
    prisma.vendorCheck.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CrossCheckService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationsService, useValue: { resolveSettings: jest.fn(async () => settings) } },
        { provide: TrustScoreService, useValue: trustScore },
        { provide: RealtimePublisher, useValue: realtime },
      ],
    }).compile();
    service = moduleRef.get(CrossCheckService);
  });

  it('builds rule documents with effective values and confirmation state', async () => {
    const d = doc('d1', DocType.SSM, { company_name: 'BINA JAYA SDN BHD' });
    d.fields[0].correctedValue = 'BINA JAYA SDN BHD (CORRECTED)';
    d.fields[0].confirmedAt = new Date();
    prisma.document.findMany.mockResolvedValue([d]);
    const docs = await service.buildRuleDocuments('s1');
    expect(docs[0].fields.company_name).toEqual({ value: 'BINA JAYA SDN BHD (CORRECTED)', confidence: 0.95, confirmed: true });
  });

  it('stores supplier-level findings, updates the passport and publishes an event', async () => {
    prisma.document.findMany.mockResolvedValue([
      doc('ssm', DocType.SSM, { company_name: 'BINA JAYA SDN BHD', registration_no: '201501023456' }),
      doc('ins', DocType.PUBLIC_LIABILITY, { insured_party: 'BINA JAYA ENGINEERING SDN BHD' }, { expiresAt: new Date(Date.now() + 10 * 86_400_000) }),
      doc('old', DocType.PUBLIC_LIABILITY, { insured_party: 'SOMEONE ELSE' }, { supersededById: 'ins' }),
    ]);
    const event = await service.recomputeForSupplier('s1');
    const rules = event.findings.map((f) => f.rule).sort();
    expect(rules).toEqual([
      RuleCode.COMPANY_NAME_MISMATCH,
      RuleCode.DOCUMENT_EXPIRING_SOON,
      RuleCode.REQUIRED_DOCUMENT_MISSING,
      RuleCode.REQUIRED_DOCUMENT_MISSING,
      RuleCode.REQUIRED_DOCUMENT_MISSING,
    ].sort());
    expect(event.trustScore).toBe(100 - 20 - 10 - 45);
    expect(findings.filter((f) => f.vendorCheckId === null)).toHaveLength(5);
    expect(trustScore.applyToPassport).toHaveBeenCalledWith('s1', 25, expect.any(Array), 2);
    expect(realtime.toSupplier).toHaveBeenCalledWith('s1', SOCKET_EVENTS.findingsUpdated, expect.objectContaining({ supplierId: 's1', band: 'red' }));
  });

  it('re-evaluates open vendor checks with their contract value and required documents', async () => {
    prisma.document.findMany.mockResolvedValue([
      doc('ssm', DocType.SSM, { company_name: 'BINA JAYA SDN BHD' }),
      doc('cidb', DocType.CIDB, { company_name: 'BINA JAYA SDN BHD', grade: 'G5' }, { expiresAt: new Date(Date.now() + 400 * 86_400_000) }),
    ]);
    prisma.vendorCheck.findMany.mockResolvedValue([{ id: 'vc1', buyerId: 'b1', supplierId: 's1', contractValue: '8000000', requiredDocTypes: [DocType.SSM, DocType.CIDB] }]);
    await service.recomputeForSupplier('s1');
    const checkFindings = findings.filter((f) => f.vendorCheckId === 'vc1');
    expect(checkFindings.map((f) => f.rule)).toEqual([RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE]);
    expect(checkFindings[0].severity).toBe(Severity.CRITICAL);
    expect(prisma.vendorCheck.update).toHaveBeenCalledWith({ where: { id: 'vc1' }, data: { trustScore: 75 } });
  });

  it('serializes concurrent recomputes for the same supplier', async () => {
    prisma.document.findMany.mockResolvedValue([doc('ssm', DocType.SSM, { company_name: 'X SDN BHD' })]);
    await Promise.all([service.recomputeForSupplier('s1'), service.recomputeForSupplier('s1'), service.recomputeForSupplier('s1')]);
    // Three runs, but never more findings than one run produces (4 missing required documents).
    expect(findings).toHaveLength(4);
  });
});
