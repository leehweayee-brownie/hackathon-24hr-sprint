import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[46%] flex-col justify-between border-r border-line bg-panel p-10 lg:flex">
        <Logo />
        <div className="max-w-md">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-primary">Vendor onboarding</p>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">Upload once, reuse everywhere.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Drop a vendor&apos;s documents once. Every certificate is sorted, read and cross-checked against the others, so buyers get a trust score with reasons and vendors get a passport they can share by link.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 text-[13px]">
            <div>
              <dt className="text-muted">Manual review</dt>
              <dd className="tabular mt-1 text-[20px] font-semibold text-ink line-through decoration-muted/60">2 h</dd>
            </div>
            <div>
              <dt className="text-muted">With Vendor Passport</dt>
              <dd className="tabular mt-1 text-[20px] font-semibold text-primary">10 min</dd>
            </div>
            <div>
              <dt className="text-muted">Per 500 vendors / yr</dt>
              <dd className="tabular mt-1 text-[20px] font-semibold text-ink">~900 h</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted">est. — to be verified with procurement</p>
        </div>
        <p className="text-[12px] text-muted">All demo data is fictional.</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
