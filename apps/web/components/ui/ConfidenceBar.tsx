import { DEFAULT_CONFIDENCE_THRESHOLD } from '@vp/shared';
import { cn } from '@/utils/cn';
import { confidenceTone } from '@/utils/status';

const colors = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-muted' };

export function ConfidenceBar({ value, threshold = DEFAULT_CONFIDENCE_THRESHOLD, className }: { value: number; threshold?: number; className?: string }) {
  const tone = confidenceTone(value, threshold);
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={cn('flex items-center gap-2', className)} title={`Confidence ${pct}% (threshold ${Math.round(threshold * 100)}%)`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line-soft">
        <div className={cn('h-full rounded-full', colors[tone])} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('tabular text-[12px]', tone === 'success' ? 'text-muted' : 'text-warning font-medium')}>{pct}%</span>
    </div>
  );
}
