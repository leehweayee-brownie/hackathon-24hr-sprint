'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import { useAuth, useLogin } from '@/hooks/useAuth';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';
import { homeForUser } from '@/utils/roles';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

type Role = 'supplier' | 'buyer';
const ROLE_LABELS: Record<Role, string> = { supplier: 'Supplier', buyer: 'Buyer' };

const DEMO_PASSWORD = 'Password123!';
const DEMO_ACCOUNTS: Array<{ role: Role; label: string; email: string }> = [
  { role: 'supplier', label: 'Supplier Demo · Bina Jaya Sdn Bhd', email: 'supplier@binajaya.local' },
  { role: 'buyer', label: 'Buyer Demo · Procurement Officer', email: 'buyer@procurement.local' },
];

/** Figma input: 32px high, 10px side padding, gray-200 border, field shadow, 14px text. */
const fieldClass = 'h-8 px-2.5 border-otl-gray-200 shadow-field text-txt-black-900 placeholder:text-txt-black-500';
const labelClass = '[&_label]:text-sm [&_label]:font-medium [&_label]:leading-5 [&_label]:text-txt-black-700';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, hydrated } = useAuth();
  const login = useLogin();
  const [role, setRole] = useState<Role>('supplier');
  const { register, handleSubmit, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (hydrated && user) router.replace(params.get('next') ?? homeForUser(user));
  }, [hydrated, user, router, params]);

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setRole(account.role);
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
  };

  return (
    // Design spacing (32px between sections) from 900px tall; tighter steps below so the card fits without scrolling.
    <div className="flex w-full max-w-[523px] flex-col items-end gap-8 rounded-xl p-6 [@media(min-height:761px)_and_(max-height:899px)]:gap-4 [@media(min-height:701px)_and_(max-height:760px)]:gap-3 [@media(min-height:701px)_and_(max-height:760px)]:py-4 [@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:py-3">
      {/* Figma "Group 1": VendVet mark (21×23) and Inter Black wordmark, top left of the card */}
      <div className="flex h-7 w-full items-center gap-0.5" role="img" aria-label="VendVet">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset from Figma */}
        <img src="/figma/login/logo-mark.svg" alt="" width={21} height={23} className="h-[22.59px] w-[21.285px] shrink-0" />
        <span className="text-[23.2px] font-black leading-7 text-black">VendVet</span>
      </div>

      {/* Role */}
      <div className="flex w-full items-start gap-4">
        <div className={cn('w-[180px]', labelClass)}>
          <Field label="Your Role" htmlFor="role">
            <Select id="role" chevron value={role} onChange={(e) => setRole(e.target.value as Role)} className={fieldClass}>
              <option value="supplier">Supplier</option>
              <option value="buyer">Buyer</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Title */}
      <div className="flex w-full flex-col gap-2 text-black">
        <h1 className="font-display text-[36px] font-semibold leading-[44px]">Log In</h1>
        <p className="text-sm leading-5">As a {ROLE_LABELS[role]}</p>
      </div>

      <form id="login-form" className="flex w-full flex-col gap-4" onSubmit={handleSubmit((v) => login.mutate(v))} noValidate>
        <div className={labelClass}>
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" placeholder="Example: 77771111234" className={fieldClass} error={formState.errors.email?.message} {...register('email')} />
          </Field>
        </div>
        <div className="flex flex-col items-start gap-2">
          <div className={cn('w-full', labelClass)}>
            <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" className={fieldClass} error={formState.errors.password?.message} {...register('password')} />
            </Field>
          </div>
          <Button
            type="button"
            variant="link"
            className="h-6 px-2.5 text-sm leading-5"
            onClick={() => toast({ title: 'Reset your password', description: 'Ask your organisation admin to reset it for you.', tone: 'neutral' })}
          >
            Forgot Password?
          </Button>
        </div>
        {login.isError ? (
          <p className="rounded-card border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
            {errorMessage(login.error)}
          </p>
        ) : null}
      </form>

      <div className="flex w-full justify-end">
        <Button type="submit" form="login-form" variant="brand" className="h-9 px-3 text-sm leading-5" loading={login.isPending}>
          Log In
        </Button>
      </div>

      {/* Register */}
      <div className="flex w-full flex-col items-center gap-2">
        <p className="text-center text-sm leading-5 text-black">No account? Register now.</p>
        <Link href="/register" className="rounded-lg px-3 py-2 text-sm font-medium leading-5 text-link hover:underline">
          Sign up
        </Link>
      </div>

      {/* Demo accounts */}
      <div className="flex w-full items-center justify-center gap-1" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/login/divider-line.svg" alt="" width={181} height={1} className="h-px min-w-px flex-1" />
        <span className="whitespace-nowrap text-center font-display text-sm font-medium leading-5 text-txt-black-500">Demo Account</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/login/divider-line.svg" alt="" width={181} height={1} className="h-px min-w-px flex-1" />
      </div>
      <div className="flex w-full flex-col gap-4">
        {DEMO_ACCOUNTS.map((account) => (
          <Button key={account.email} type="button" variant="outline" className="h-10 w-full px-3 text-base leading-6" onClick={() => fillDemo(account)}>
            {account.label}
          </Button>
        ))}
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
