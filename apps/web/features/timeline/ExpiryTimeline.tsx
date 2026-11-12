'use client';

import type { TimelineEntry } from '@vp/shared';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

const STATE_STYLE: Record<TimelineEntry['state'], { dot: string; bar: string; text: string; label: string }> = {
  valid: { dot: 'bg-success', bar: 'bg-success/25', text: 'text-success', label: 'Valid' },
  expiring: { dot: 'bg-warning', bar: 'bg-warning/30', text: 'text-warning', label: 'Expiring soon' },
  expired: { dot: 'bg-danger', bar: 'bg-danger/30', text: 'text-danger', label: 'Expired' },
  no_expiry: { dot: 'bg-muted', bar: 'bg-line', text: 'text-muted', label: 'No expiry' },
};

function daysLabel(e: TimelineEntry): string {
  if (e.daysToExpiry === null) return 'Does not expire';
  if (e.daysToExpiry < 0) return `Expired ${-e.daysToExpiry} day${e.daysToExpiry === -1 ? '' : 's'} ago`;
  if (e.daysToExpiry === 0) return 'Expires today';
  return `${e.daysToExpiry} day${e.daysToExpiry === 1 ? '' : 's'} left`;
}

/** Horizontal validity timeline: today is the vertical marker; each row is one document's validity window. */
export function ExpiryTimeline({ entries, documentHref, horizonDays = 365 }: { entries: TimelineEntry[]; documentHref?: (id: string) => string; horizonDays?: number }) {
  const dated = entries.filter((e) => e.expiresAt);
  if (entries.length === 0) return <EmptyState icon={CalendarClock} title="No documents yet" />;
  const past = 90;
  const total = past + horizonDays;
  const pct = (days: number) => Math.max(0, Math.min(100, ((days + past) / total) * 100));
  const todayPct = pct(0);

  return (
    <div data-testid="expiry-timeline">
      <div className="relative mb-2 ml-56 hidden h-5 md:block">
        <div className="absolute inset-x-0 top-2 h-px bg-line" />
        {[-90, 0, 90, 180, 270, 365].map((d) => (
          <span key={d} className="absolute top-0 -translate-x-1/2 text-[11px] text-muted" style={{ left: `${pct(d)}%` }}>
            {d === 0 ? 'Today' : d < 0 ? `${d}d` : `+${d}d`}
          </span>
        ))}
      </div>
      <ul className="space-y-1.5">
        {entries.map((e) => {
          const style = STATE_STYLE[e.state];
          const end = e.daysToExpiry ?? horizonDays;
          const left = 0;
          const width = e.expiresAt ? pct(end) : 100;
          const body = (
            <div className="flex items-center gap-3 rounded-card px-2 py-1.5 hover:bg-surface">
              <div className="w-52 shrink-0">
                <p className="truncate text-[13px] font-medium text-ink">{e.docTypeLabel}</p>
                <p className="truncate text-[12px] text-muted">{e.fileName}</p>
              </div>
              <div className="relative hidden h-6 flex-1 md:block">
                <div className="absolute inset-y-0 w-px bg-ink/30" style={{ left: `${todayPct}%` }} aria-hidden />
                <div className={cn('absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full', style.bar)} style={{ left: `${left}%`, width: `${width}%` }} />
                {e.expiresAt ? <div className={cn('absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel', style.dot)} style={{ left: `${width}%` }} /> : null}
              </div>
              <div className="w-40 shrink-0 text-right">
                <p className={cn('text-[12px] font-medium', style.text)}>{daysLabel(e)}</p>
                <p className="text-[12px] text-muted">{e.expiresAt ? formatDate(e.expiresAt) : style.label}</p>
              </div>
            </div>
          );
          return <li key={e.documentId}>{documentHref ? <Link href={documentHref(e.documentId)}>{body}</Link> : body}</li>;
        })}
      </ul>
      {dated.length === 0 ? <p className="mt-2 text-[12px] text-muted">None of these documents carry an expiry date.</p> : null}
    </div>
  );
}
