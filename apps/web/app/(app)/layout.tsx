'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { areaForUser, homeForUser } from '@/utils/roles';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const area = areaForUser(user);
    const wanted = pathname.split('/')[1];
    if (['supplier', 'buyer', 'admin'].includes(wanted) && wanted !== area) router.replace(homeForUser(user));
  }, [hydrated, isAuthenticated, user, pathname, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <PageSkeleton />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
