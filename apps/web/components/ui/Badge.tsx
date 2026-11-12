import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import type { Tone } from '@/utils/status';

const tones: Record<Tone, string> = {
  neutral: 'bg-line-soft text-ink-3',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium leading-5 whitespace-nowrap', tones[tone], className)}
      {...props}
    />
  );
}
