import type { TimelineEntry } from '@vp/shared';
import { CalendarClock } from 'lucide-react';
import { PanelCard, PanelHeader } from '@/components/ui/PanelCard';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

/** Figma track: 280px covers 90 days back to 365 days ahead; "Today" sits 55px in. */
const TRACK_W = 280;
const PAST_DAYS = 90;
const FUTURE_DAYS = 365;
const TODAY_X = Math.round((PAST_DAYS / (PAST_DAYS + FUTURE_DAYS)) * TRACK_W);
const AXIS: Array<[label: string, days: number]> = [
  ['−90d', -90],
  ['Today', 0],
  ['+90d', 90],
  ['+180d', 180],
  ['+270d', 270],
  ['+365d', 365],
];
const xFor = (days: number) => TODAY_X + (days / (PAST_DAYS + FUTURE_DAYS)) * TRACK_W;

const STATE = {
  valid: { fill: 'bg-teal-500', text: 'text-teal-700', row: '' },
  expiring: { fill: 'bg-amber-500', text: 'text-amber-700', row: 'bg-amber-50' },
  expired: { fill: 'bg-red-500', text: 'text-red-700', row: 'bg-red-50' },
  no_expiry: { fill: '', text: 'text-gray-500', row: '' },
} as const;

function Track({ entry }: { entry: TimelineEntry }) {
  const days = entry.daysToExpiry;
  const s = STATE[entry.state];
  let bar: { left: number; width: number } | null = null;
  if (days !== null && entry.state !== 'no_expiry') {
    const clamped = Math.max(-PAST_DAYS, Math.min(FUTURE_DAYS, days));
    const end = xFor(clamped);
    bar = clamped >= 0 ? { left: TODAY_X, width: Math.max(4, end - TODAY_X) } : { left: end, width: Math.max(4, TODAY_X - end) };
  }
  return (
    <div className="relative h-5 shrink-0" style={{ width: TRACK_W }} aria-hidden>
      <span className="absolute left-0 top-[7px] h-1.5 rounded-[3px] bg-gray-100" style={{ width: TRACK_W }} />
      {bar ? <span className={cn('absolute top-[7px] h-1.5 rounded-[3px]', s.fill)} style={{ left: bar.left, width: bar.width }} /> : null}
      <span className="absolute top-0 h-5 w-px bg-gray-400" style={{ left: TODAY_X }} />
    </div>
  );
}

function Remaining({ entry }: { entry: TimelineEntry }) {
  const s = STATE[entry.state];
  const days = entry.daysToExpiry;
  let headline = 'Does not expire';
  if (entry.state !== 'no_expiry' && days !== null) {
    headline = days < 0 ? `Expired ${-days} ${days === -1 ? 'day' : 'days'} ago` : days === 0 ? 'Expires today' : `${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  return (
    <div className="flex w-[110px] shrink-0 flex-col items-end text-xs leading-4">
      <p className={cn('font-medium', s.text)}>{headline}</p>
      <p className="text-gray-500">{entry.expiresAt && entry.state !== 'no_expiry' ? formatDate(entry.expiresAt) : 'No expiry'}</p>
    </div>
  );
}

/** Figma "Card / Expiry timeline": legend, axis and one track per document, soonest expiry first. */
export function ExpiryTimelineCard({ timeline, variant = 'supplier' }: { timeline: TimelineEntry[]; variant?: 'supplier' | 'public' }) {
  const isPublic = variant === 'public';
  const rows = [...timeline].sort((a, b) => {
    if (a.daysToExpiry === null || a.state === 'no_expiry') return 1;
    if (b.daysToExpiry === null || b.state === 'no_expiry') return -1;
    return a.daysToExpiry - b.daysToExpiry;
  });
  return (
    <PanelCard>
      <PanelHeader icon={isPublic ? undefined : CalendarClock} title="Expiry timeline" subtitle="Amber within 30 days of expiry, red when expired." bordered={isPublic}>
        <ul className={cn('hidden shrink-0 items-center gap-3 text-xs leading-4 text-gray-500', !isPublic && 'sm:flex')}>
          {[
            ['bg-teal-500', 'Valid'],
            ['bg-amber-500', '≤ 30 days'],
            ['bg-red-500', 'Expired'],
          ].map(([dot, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', dot)} /> {label}
            </li>
          ))}
        </ul>
      </PanelHeader>
      {rows.length === 0 ? (
        <p className={cn('px-5 pb-5 text-sm text-gray-500', isPublic && 'pt-4')}>{isPublic ? 'No documents on file yet.' : 'No documents yet. Upload some to see their validity here.'}</p>
      ) : (
        <div className="overflow-x-auto px-5 pb-4 pt-3">
          <div className="flex min-w-[600px] flex-col gap-1">
            <div className="flex items-center gap-4 px-3">
              <div className="min-w-0 flex-1" />
              <div className="relative h-4 shrink-0 text-xs leading-4" style={{ width: TRACK_W }}>
                {AXIS.map(([label, days]) => (
                  <span key={label} className={cn('absolute top-0 -translate-x-1/2 whitespace-nowrap', days === 0 ? 'font-medium text-gray-700' : 'text-gray-400')} style={{ left: xFor(days) }}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="w-[110px] shrink-0" />
            </div>
            {rows.map((entry) => (
              <div key={entry.documentId} className={cn('flex items-center gap-4 rounded-lg px-3 py-2.5', STATE[entry.state].row)}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-medium leading-5 text-gray-800">{entry.docTypeLabel}</p>
                  <p className="truncate text-xs leading-4 text-gray-500">{entry.fileName}</p>
                </div>
                <Track entry={entry} />
                <Remaining entry={entry} />
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  );
}
