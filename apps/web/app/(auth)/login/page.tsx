'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useAuth, useLogin } from '@/hooks/useAuth';
import { errorMessage } from '@/services/http';
import { homeForUser } from '@/utils/roles';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

const SEED_ACCOUNTS = [
  { label: 'Supplier', hint: 'Bina Jaya Sdn Bhd', email: 'supplier@binajaya.local' },
  { label: 'Buyer', hint: 'Procurement officer', email: 'buyer@procurement.local' },
  { label: 'Admin', hint: 'Platform admin', email: 'admin@vp.local' },
];
const SEED_PASSWORD = 'Password123!';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, hydrated } = useAuth();
  const login = useLogin();
  const { register, handleSubmit, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (hydrated && user) router.replace(params.get('next') ?? homeForUser(user));
  }, [hydrated, user, router, params]);

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Use your organisation account.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit((v) => login.mutate(v))} noValidate>
        <Field label="Email" error={formState.errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} error={formState.errors.email?.message} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} error={formState.errors.password?.message} />
        </Field>
        {login.isError ? (
          <p className="rounded-card border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
            {errorMessage(login.error)}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-[13px] text-muted">
        New organisation?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Register
        </Link>
      </p>

      <div className="mt-8 rounded-card border border-line bg-surface p-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">Demo accounts</p>
        <div className="mt-2 grid gap-2">
          {SEED_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setValue('email', a.email);
                setValue('password', SEED_PASSWORD);
              }}
              className="flex items-center justify-between rounded-card border border-line bg-panel px-3 py-2 text-left text-[13px] hover:border-primary"
            >
              <span>
                <span className="font-medium text-ink">{a.label}</span> <span className="text-muted">· {a.hint}</span>
              </span>
              <span className="font-mono text-[12px] text-muted">{a.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Password <span className="font-mono">{SEED_PASSWORD}</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
