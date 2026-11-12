'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authService } from '@/services/auth';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
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
  const setAuthRole = useUiStore((s) => s.setAuthRole);
  // The panel beside the form says "Vendor onboarding" or "Buyer onboarding" to match.
  useEffect(() => setAuthRole(type === 'BUYER' ? 'buyer' : 'vendor'), [type, setAuthRole]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await authService.register(values);
      // A new account starts with the default pointer, not a cursor theme left by a previous user of this browser.
      useUiStore.getState().setCursorTheme('none');
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
      <div className="flex w-full max-w-[420px] flex-col gap-1.5">
        <h1 className="text-2xl font-semibold leading-8 text-gray-900">Check your inbox</h1>
        <p className="text-sm leading-5 text-gray-500">We sent a verification link to your email. In this demo environment the link is printed in the API log.</p>
        <Link href="/login" className="mt-4 text-sm font-medium leading-5 text-brand hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const fieldClass = (invalid?: boolean) =>
    cn(
      'w-full rounded-lg border bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2',
      invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-brand focus:ring-brand/20',
    );

  /** Figma "Input / Field": 14/20 medium label, 8px gap, input, helper or error underneath. */
  const field = (id: keyof FormValues, label: string, input: ReactNode, hint?: string) => {
    const err = formState.errors[id]?.message;
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium leading-5 text-gray-800">
          {label}
        </label>
        {input}
        {err ? (
          <p className="text-xs leading-4 text-red-600" role="alert">
            {err}
          </p>
        ) : hint ? (
          <p className="text-xs leading-4 text-gray-500">{hint}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold leading-8 text-gray-900">Register your organisation</h1>
        <p className="text-sm leading-5 text-gray-500">Vendors build a passport. Buyers run vendor checks.</p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Figma "Account type": two radio cards, brand-tinted when selected */}
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Organisation type">
          {(['SUPPLIER', 'BUYER'] as const).map((t) => {
            const selected = type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setValue('organizationType', t)}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-left transition-colors',
                  selected ? 'border-[1.5px] border-brand bg-brand-tint' : 'border border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn('text-sm font-semibold leading-5', selected ? 'text-brand-700' : 'text-gray-800')}>{t === 'SUPPLIER' ? 'Vendor' : 'Buyer'}</span>
                  <span className={cn('truncate text-xs leading-4', selected ? 'text-brand' : 'text-gray-500')}>
                    {t === 'SUPPLIER' ? 'Contractor or provider' : 'Procurement organisation'}
                  </span>
                </span>
                <span
                  className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full', selected ? 'bg-brand' : 'border border-gray-300 bg-white')}
                  aria-hidden
                >
                  {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                </span>
              </button>
            );
          })}
        </div>

        {field('organizationName', 'Organisation name', (
          <input id="organizationName" placeholder="Bina Jaya Sdn Bhd" className={fieldClass(!!formState.errors.organizationName)} {...register('organizationName')} />
        ))}
        {field(
          'registrationNo',
          'SSM registration number',
          <input id="registrationNo" placeholder="201501023456 (1156789-K)" className={fieldClass()} {...register('registrationNo')} />,
          'Optional',
        )}
        {field('name', 'Your name', <input id="name" placeholder="Aisyah Rahman" autoComplete="name" className={fieldClass(!!formState.errors.name)} {...register('name')} />)}
        {field(
          'email',
          'Work email',
          <input id="email" type="email" autoComplete="email" placeholder="you@company.com.my" className={fieldClass(!!formState.errors.email)} {...register('email')} />,
        )}
        {field(
          'password',
          'Password',
          <input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" className={fieldClass(!!formState.errors.password)} {...register('password')} />,
        )}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create account
        </button>
      </form>

      <p className="flex gap-1 text-sm leading-5">
        <span className="text-gray-500">Already registered?</span>
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
