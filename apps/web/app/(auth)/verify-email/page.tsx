'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/auth';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/auth';
import { homeForUser } from '@/utils/roles';

function VerifyEmail() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const verify = useMutation({
    mutationFn: () => authService.verifyEmail(token),
    onSuccess: (res) => {
      if ('tokens' in res) {
        setSession(res.user, res.tokens);
        setTimeout(() => router.replace(homeForUser(res.user)), 800);
      }
    },
  });

  useEffect(() => {
    if (token) verify.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink">Email verification</h1>
      {!token ? <p className="mt-2 text-sm text-danger">This link is missing its token.</p> : null}
      {verify.isPending ? <p className="mt-2 text-sm text-muted">Verifying…</p> : null}
      {verify.isSuccess ? <p className="mt-2 text-sm text-success">Your email is verified. Taking you in…</p> : null}
      {verify.isError ? <p className="mt-2 text-sm text-danger">{errorMessage(verify.error)}</p> : null}
      <Link href="/login" className="mt-6 inline-block">
        <Button variant="secondary">Go to sign in</Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
