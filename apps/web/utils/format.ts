import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

export function formatMoney(value: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  if (opts.compact && Math.abs(n) >= 1_000_000) {
    return `RM${(n / 1_000_000).toLocaleString('en-MY', { maximumFractionDigits: 1 })}M`;
  }
  return `RM${n.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = value.length <= 10 ? parseISO(`${value}T00:00:00`) : parseISO(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy'): string {
  const d = toDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, 'd MMM yyyy, HH:mm');
}

export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${formatDistanceToNowStrict(d)} ago` : '—';
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** File size for meta lines, e.g. "1.2 MB", "840 KB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
