import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/utils/cn';

/** Figma "KPI" card: white, gray-200 border, 12px radius, 20px padding, caps label with an icon box. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconBox,
  iconColor,
  valueClassName,
  badge,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Icon box background, e.g. bg-blue-50. */
  iconBox: string;
  /** Icon colour, e.g. text-blue-600. */
  iconColor: string;
  /** Value colour override, e.g. text-blue-600 (default gray-800). */
  valueClassName?: string;
  /** Figma "Delta" badge shown after the value. */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[160px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.05)]', className)}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', iconBox)}>
          <Icon className={cn('size-4', iconColor)} aria-hidden />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className={cn('tabular text-2xl font-semibold leading-8', valueClassName ?? 'text-gray-800')}>{value}</p>
        {badge}
      </div>
      {hint ? <p className="text-xs leading-4 text-gray-500">{hint}</p> : null}
    </div>
  );
}
