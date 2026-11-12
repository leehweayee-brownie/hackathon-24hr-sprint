/**
 * Relative date tokens used in recorded extractions so the demo stays true on any day.
 *
 * Grammar:  {{today}}  |  {{today+23d}}  |  {{today-60d}}  |  {{today+23d:dd/MM/yyyy}}
 * Default format is ISO (yyyy-MM-dd). Supported formats: yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy,
 * d MMMM yyyy, d MMM yyyy, dd MMMM yyyy, dd MMM yyyy. "Today" is the current UTC date.
 */
export const TOKEN_RE = /\{\{today(?:([+-]\d+)d)?(?::([^}]+))?\}\}/g;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function utcToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function formatDate(date: Date, fmt = 'yyyy-MM-dd'): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  switch (fmt) {
    case 'yyyy-MM-dd':
      return `${y}-${pad(m + 1)}-${pad(d)}`;
    case 'dd/MM/yyyy':
      return `${pad(d)}/${pad(m + 1)}/${y}`;
    case 'dd-MM-yyyy':
      return `${pad(d)}-${pad(m + 1)}-${y}`;
    case 'd MMMM yyyy':
      return `${d} ${MONTHS[m]} ${y}`;
    case 'dd MMMM yyyy':
      return `${pad(d)} ${MONTHS[m]} ${y}`;
    case 'd MMM yyyy':
      return `${d} ${MONTHS[m].slice(0, 3)} ${y}`;
    case 'dd MMM yyyy':
      return `${pad(d)} ${MONTHS[m].slice(0, 3)} ${y}`;
    default:
      throw new Error(`Unsupported date format: ${fmt}`);
  }
}

/** Builds a token for a date `offsetDays` from today, printed with `fmt`. */
export function dateToken(offsetDays: number, fmt = 'yyyy-MM-dd'): string {
  const off = offsetDays === 0 ? '' : `${offsetDays > 0 ? '+' : '-'}${Math.abs(offsetDays)}d`;
  return fmt === 'yyyy-MM-dd' ? `{{today${off}}}` : `{{today${off}:${fmt}}}`;
}

/** Replaces every token in a string with the concrete date. Non-token strings are returned unchanged. */
export function resolveDateTokens(value: string, now: Date = new Date()): string {
  const today = utcToday(now);
  return value.replace(TOKEN_RE, (_m, offset: string | undefined, fmt: string | undefined) =>
    formatDate(addUtcDays(today, offset ? parseInt(offset, 10) : 0), fmt ?? 'yyyy-MM-dd'),
  );
}

export function resolveDateTokensOrNull(value: string | null | undefined, now?: Date): string | null {
  if (value === null || value === undefined) return null;
  return resolveDateTokens(value, now);
}
