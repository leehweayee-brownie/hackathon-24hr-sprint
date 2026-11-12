import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { Tone } from '@/utils/status';

const toneText: Record<Tone, string> = { neutral: 'text-ink', info: 'text-info', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };

export function Stat({ label, value, hint, tone = 'neutral', icon, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-card border border-line bg-panel px-5 py-4 shadow-card', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{label}</p>
        {icon}
      </div>
      <p className={cn('tabular mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em]', toneText[tone])}>{value}</p>
      {hint ? <p className="mt-2 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}
