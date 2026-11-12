import { Injectable } from '@nestjs/common';
import { OrganizationType, UserRole } from '@vp/shared';
import { AppException } from '../common/errors/app.exception';
import type { RequestUser } from '../common/types';
import { PrismaService } from '../database/prisma.service';

/** Organization-scoped access: suppliers see their own documents; buyers see suppliers they check or who shared with them. */
@Injectable()
export class DocumentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canReadSupplier(user: RequestUser, supplierId: string): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    if (user.organizationType === OrganizationType.SUPPLIER) return user.organizationId === supplierId;
    const [check, share] = await Promise.all([
      this.prisma.vendorCheck.findFirst({ where: { buyerId: user.organizationId, supplierId }, select: { id: true } }),
      this.prisma.passportShare.findFirst({
        where: { buyerId: user.organizationId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], passport: { supplierId } },
        select: { id: true },
      }),
    ]);
    return Boolean(check || share);
  }

  async assertCanReadSupplier(user: RequestUser, supplierId: string): Promise<void> {
    if (!(await this.canReadSupplier(user, supplierId))) throw AppException.forbidden('You do not have access to this supplier');
  }

  assertCanWriteSupplier(user: RequestUser, supplierId: string): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.organizationType !== OrganizationType.SUPPLIER || user.organizationId !== supplierId) {
      throw AppException.forbidden('Only the supplier can change its documents');
    }
  }
}
