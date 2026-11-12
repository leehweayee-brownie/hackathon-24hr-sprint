'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { authService } from '@/services/auth';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/auth';
import { homeForUser } from '@/utils/roles';

const schema = z.object({ name: z.string().min(2, 'Enter your name'), password: z.string().min(8, 'At least 8 characters') });
type FormValues = z.infer<typeof schema>;

function AcceptInvite() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      const res = await authService.acceptInvite({ token, ...v });
      setSession(res.user, res.tokens);
      router.replace(homeForUser(res.user));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink">Join your team</h1>
      <p className="mt-1 text-sm text-muted">Set your name and a password to accept the invitation.</p>
      {!token ? <p className="mt-4 text-sm text-danger">This invitation link is missing its token.</p> : null}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Your name" error={formState.errors.name?.message} htmlFor="name">
          <Input id="name" {...register('name')} error={formState.errors.name?.message} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} error={formState.errors.password?.message} />
        </Field>
        {error ? <p className="text-[13px] text-danger" role="alert">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting} disabled={!token}>
          Accept invitation
        </Button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInvite />
    </Suspense>
  );
}
