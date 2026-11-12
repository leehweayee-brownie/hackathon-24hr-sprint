import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Figma "Badge" (Preline soft badge): Red = high risk, Amber = medium, Teal = low / valid. */
export type BadgeTone = 'red' | 'amber' | 'teal';

const TONES: Record<BadgeTone, string> = {
  red: 'bg-brand-100 text-brand-800',
  amber: 'bg-amber-100 text-amber-800',
  teal: 'bg-teal-100 text-teal-800',
};

export function SoftBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium leading-4', TONES[tone], className)}>{children}</span>;
}
