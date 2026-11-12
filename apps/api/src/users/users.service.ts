import { Injectable } from '@nestjs/common';
import type { Organization, User } from '@prisma/client';
import { OrganizationType, UserRole, UserView } from '@vp/shared';
import { PrismaService } from '../database/prisma.service';
import type { RequestUser } from '../common/types';

export type UserWithOrg = User & { organization: Organization };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserWithOrg | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { organization: true } });
  }

  findById(id: string): Promise<UserWithOrg | null> {
    return this.prisma.user.findUnique({ where: { id }, include: { organization: true } });
  }

  toView(user: UserWithOrg): UserView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationType: user.organization.type as OrganizationType,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  toRequestUser(user: UserWithOrg): RequestUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
      organizationType: user.organization.type as OrganizationType,
      organizationName: user.organization.name,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }
}
