import { Test } from '@nestjs/testing';
import { DocType, ErrorCode, OrganizationType, UserRole, VendorCheckStatus } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { VendorChecksService } from './vendor-checks.service';

const officer: RequestUser = { id: 'u1', name: 'Officer', email: 'o@b.local', role: UserRole.BUYER_PROCUREMENT, organizationId: 'buyer', organizationType: OrganizationType.BUYER, organizationName: 'Northbridge', emailVerified: true };
const approver: RequestUser = { ...officer, id: 'u2', role: UserRole.BUYER_APPROVER };
const supplierUser: RequestUser = { ...officer, id: 'u3', role: UserRole.SUPPLIER_OWNER, organizationId: 'supplier', organizationType: OrganizationType.SUPPLIER };

describe('VendorChecksService decisions', () => {
  let service: VendorChecksService;
  const check = { id: 'vc1', buyerId: 'buyer', supplierId: 'supplier', tenderTitle: 'Package 3B', contractValue: '8000000', requiredDocTypes: [DocType.SSM, DocType.CIDB], trustScore: 60, status: VendorCheckStatus.IN_REVIEW, decidedById: null, decidedAt: null, decisionNote: null, createdById: 'u1', createdAt: new Date(), updatedAt: new Date(), supplier: { name: 'Bina Jaya' }, decidedBy: null };
  const prisma = {
    vendorCheck: { findUnique: jest.fn(async () => ({ ...check })), update: jest.fn(async () => check) },
    documentField: { count: jest.fn(async () => 0) },
    document: { findMany: jest.fn(async () => []) },
    vendorRating: { findUnique: jest.fn(async () => null) },
    organization: { findFirst: jest.fn() },
  };
  const settings = { confidenceThreshold: 0.85, expiryWarningDays: 30, minLiabilityCoverage: null, approverThreshold: 5_000_000, ruleWeights: {} };
  const notifications = { notifyOrg: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    check.status = VendorCheckStatus.IN_REVIEW;
    const moduleRef = await Test.createTestingModule({
      providers: [
        VendorChecksService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationsService, useValue: { resolveSettings: jest.fn(async () => settings) } },
        { provide: CrossCheckService, useValue: { recomputeCheck: jest.fn(), buildRuleDocuments: jest.fn(async () => []), findings: jest.fn(async () => []), timeline: jest.fn(() => []) } },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(VendorChecksService);
  });

  it('requires an approver above the approver threshold', async () => {
    await expect(service.approve(officer, 'vc1', {})).rejects.toMatchObject({ code: ErrorCode.APPROVER_REQUIRED });
    expect(prisma.vendorCheck.update).not.toHaveBeenCalled();
  });

  it('lets an approver approve and notifies the supplier', async () => {
    const view = await service.approve(approver, 'vc1', { note: 'Looks good' });
    expect(prisma.vendorCheck.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: VendorCheckStatus.APPROVED, decidedById: 'u2', decisionNote: 'Looks good' }) }));
    expect(notifications.notifyOrg).toHaveBeenCalledWith('supplier', expect.objectContaining({ type: 'vendor_check.approved' }));
    expect(view.requiresApprover).toBe(true);
  });

  it('lets an officer approve below the threshold', async () => {
    prisma.vendorCheck.findUnique.mockResolvedValueOnce({ ...check, contractValue: '1800000' });
    await service.approve(officer, 'vc1', {});
    expect(prisma.vendorCheck.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: VendorCheckStatus.APPROVED }) }));
  });

  it('blocks approval while low-confidence fields on required documents are unconfirmed', async () => {
    prisma.documentField.count.mockResolvedValueOnce(2);
    await expect(service.approve(approver, 'vc1', {})).rejects.toMatchObject({ code: ErrorCode.FIELD_CONFIRMATION_REQUIRED });
  });

  it('rejects decisions on already-decided checks and from suppliers', async () => {
    check.status = VendorCheckStatus.APPROVED;
    await expect(service.reject(approver, 'vc1', {})).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    check.status = VendorCheckStatus.IN_REVIEW;
    await expect(service.approve(supplierUser, 'vc1', {})).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});
