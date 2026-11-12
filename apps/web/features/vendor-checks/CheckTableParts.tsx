import { VendorCheckStatus, type ScoreBand, type VendorCheckView } from '@vp/shared';
import { cn } from '@/utils/cn';
import { CHECK_STATUS_META } from '@/utils/status';

/** Figma "Progress / Bar" colours: teal ≥75, amber 60–74, primary below 60. */
const BAND_STYLE: Record<ScoreBand, { text: string; fill: string }> = {
  green: { text: 'text-teal-700', fill: 'bg-teal-500' },
  amber: { text: 'text-amber-600', fill: 'bg-amber-500' },
  red: { text: 'text-brand', fill: 'bg-brand' },
};

/** Figma "Badge" with indicator dot, per check status. */
const STATUS_BADGE: Record<VendorCheckStatus, { short: string; className: string; dot: string }> = {
  [VendorCheckStatus.DRAFT]: { short: 'Draft', className: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' },
  [VendorCheckStatus.IN_REVIEW]: { short: 'In review', className: 'bg-blue-100 text-blue-800', dot: 'bg-blue-600' },
  [VendorCheckStatus.MORE_INFO]: { short: 'More info', className: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  [VendorCheckStatus.APPROVED]: { short: 'Approved', className: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
  [VendorCheckStatus.REJECTED]: { short: 'Rejected', className: 'bg-brand-100 text-brand-800', dot: 'bg-brand' },
};

/** Figma "Avatar" fills, picked per supplier so a supplier keeps its colour. */
const AVATAR_TONES = ['bg-amber-100 text-amber-800', 'bg-blue-100 text-blue-800', 'bg-teal-100 text-teal-800', 'bg-brand-100 text-brand-800', 'bg-gray-100 text-gray-800'];

const COMPANY_SUFFIX = /\b(sdn\.?|bhd\.?|berhad|plc|ltd\.?|limited)\b/gi;

/** "Bina Jaya Sdn Bhd" → "Bina Jaya". */
export const shortCompanyName = (name: string) => name.replace(COMPANY_SUFFIX, '').replace(/\s+/g, ' ').trim() || name;

/** "Mega Wira Construction Sdn Bhd" → "MW", "Lala3 Sdn Bhd" → "L3". */
export function companyInitials(name: string): string {
  const words = shortCompanyName(name).split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] ?? '?';
  return (w[0] + (w.length > 1 ? w[w.length - 1] : '')).toUpperCase();
}

function avatarTone(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function SupplierAvatar({ id, name }: { id: string; name: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-semibold leading-4', avatarTone(id))} aria-hidden>
      {companyInitials(name)}
    </span>
  );
}

/** Score number in its band colour with a 6px bar. */
export function ScoreCell({ check, barWidth = 64 }: { check: VendorCheckView; barWidth?: number }) {
  if (check.trustScore === null || !check.band) return <span className="text-sm leading-5 text-gray-400">Scoring…</span>;
  const s = BAND_STYLE[check.band];
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('tabular w-7 text-right text-sm font-semibold leading-5', s.text)}>{check.trustScore}</span>
      <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-gray-200" style={{ width: barWidth }} aria-hidden>
        <span className={cn('absolute inset-y-0 left-0 rounded-[3px]', s.fill)} style={{ width: `${Math.max(0, Math.min(100, check.trustScore))}%` }} />
      </span>
    </div>
  );
}

/** Status badge; `short` uses compact labels for narrow columns. */
export function CheckStatusBadge({ status, short }: { status: VendorCheckStatus; short?: boolean }) {
  const b = STATUS_BADGE[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-4', b.className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', b.dot)} aria-hidden /> {short ? b.short : CHECK_STATUS_META[status].label}
    </span>
  );
}

export const reviewButtonClass =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50';
