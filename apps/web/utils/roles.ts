import { BUYER_ROLES, SUPPLIER_ROLES, UserRole, type UserView } from '@vp/shared';

export type Area = 'supplier' | 'buyer' | 'admin';

export function areaForUser(user: UserView | null | undefined): Area | null {
  if (!user) return null;
  if (user.role === UserRole.ADMIN) return 'admin';
  if ((SUPPLIER_ROLES as readonly UserRole[]).includes(user.role)) return 'supplier';
  if ((BUYER_ROLES as readonly UserRole[]).includes(user.role)) return 'buyer';
  return null;
}

export function homeForUser(user: UserView | null | undefined): string {
  const area = areaForUser(user);
  if (area === 'admin') return '/admin';
  if (area === 'buyer') return '/buyer';
  if (area === 'supplier') return '/supplier';
  return '/login';
}

export function isApprover(user: UserView | null | undefined): boolean {
  return user?.role === UserRole.BUYER_APPROVER;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPPLIER_OWNER]: 'Supplier owner',
  [UserRole.SUPPLIER_MEMBER]: 'Supplier member',
  [UserRole.BUYER_PROCUREMENT]: 'Procurement officer',
  [UserRole.BUYER_CONTRACTS]: 'Contracts officer',
  [UserRole.BUYER_FINANCE]: 'Finance officer',
  [UserRole.BUYER_PROJECT]: 'Project officer',
  [UserRole.BUYER_APPROVER]: 'Approver',
  [UserRole.ADMIN]: 'Administrator',
};
