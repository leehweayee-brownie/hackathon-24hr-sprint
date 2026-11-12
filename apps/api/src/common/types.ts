import type { OrganizationType, UserRole } from '@vp/shared';

/** The authenticated principal attached to each request / socket. */
export interface RequestUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationType: OrganizationType;
  organizationName: string;
  emailVerified: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationType: OrganizationType;
}
