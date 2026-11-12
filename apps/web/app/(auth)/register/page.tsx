'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { authService } from '@/services/auth';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/utils/cn';
import { homeForUser } from '@/utils/roles';

const schema = z.object({
  organizationType: z.enum(['SUPPLIER', 'BUYER']),
  organizationName: z.string().min(2, 'Enter the organisation name'),
  registrationNo: z.string().optional(),
  name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);
  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { organizationType: 'SUPPLIER' },
  });
  const type = watch('organizationType');

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await authService.register(values);
      if ('tokens' in res) {
        setSession(res.user, res.tokens);
        router.replace(homeForUser(res.user));
      } else {
        setPendingVerification(true);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (pendingVerification) {
    return (
      <div>
        <h1 className="text-[22px] font-semibold text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">We sent a verification link to your email. In this demo environment the link is printed in the API log.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Register your organisation</h1>
      <p className="mt-1 text-sm text-muted">Suppliers build a passport. Buyers run vendor checks.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Organisation type">
          {(['SUPPLIER', 'BUYER'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setValue('organizationType', t)}
              className={cn(
                'rounded-card border px-3 py-2.5 text-left text-[13px] transition-colors',
                type === t ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-panel text-ink-3 hover:border-ink-3',
              )}
            >
              <span className="block font-medium">{t === 'SUPPLIER' ? 'Supplier' : 'Buyer'}</span>
              <span className="block text-[12px] opacity-80">{t === 'SUPPLIER' ? 'Contractor or vendor' : 'Procurement organisation'}</span>
            </button>
          ))}
        </div>
        <Field label="Organisation name" error={formState.errors.organizationName?.message} htmlFor="organizationName">
          <Input id="organizationName" placeholder="Bina Jaya Sdn Bhd" {...register('organizationName')} error={formState.errors.organizationName?.message} />
        </Field>
        <Field label="SSM registration number" hint="Optional" htmlFor="registrationNo">
          <Input id="registrationNo" placeholder="201501023456 (1156789-K)" {...register('registrationNo')} />
        </Field>
        <Field label="Your name" error={formState.errors.name?.message} htmlFor="name">
          <Input id="name" placeholder="Aisyah Rahman" {...register('name')} error={formState.errors.name?.message} />
        </Field>
        <Field label="Work email" error={formState.errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} error={formState.errors.password?.message} />
        </Field>
        {error ? (
          <p className="rounded-card border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-[13px] text-muted">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
