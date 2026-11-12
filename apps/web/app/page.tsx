'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { homeForUser } from '@/utils/roles';

export default function IndexPage() {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  useEffect(() => {
    if (!hydrated) return;
    router.replace(user ? homeForUser(user) : '/login');
  }, [hydrated, user, router]);
  return null;
}
