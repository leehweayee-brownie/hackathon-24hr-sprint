'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const base =
  'w-full rounded-card border border-line bg-panel px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, error, ...props }, ref) {
  return <input ref={ref} className={cn(base, 'h-9', error && 'border-danger focus:border-danger focus:ring-danger/20', className)} aria-invalid={!!error} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(function Textarea(
  { className, error, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(base, 'min-h-24 py-2', error && 'border-danger', className)} {...props} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { error?: string; /** Replace the browser arrow with the design's chevron icon. */ chevron?: boolean }
>(function Select({ className, error, chevron, children, ...props }, ref) {
  const select = (
    <select ref={ref} className={cn(base, 'h-9', chevron && 'appearance-none pr-8', error && 'border-danger', className)} {...props}>
      {children}
    </select>
  );
  if (!chevron) return select;
  return (
    <div className="relative w-full">
      {select}
      {/* Figma Icon/outline/chevron-down (16×16), 10px from the right edge */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/login/chevron-down.svg" alt="" width={16} height={16} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
});

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-danger">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}
