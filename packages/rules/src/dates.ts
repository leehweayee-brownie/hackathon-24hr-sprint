const DAY_MS = 86_400_000;

function utcDay(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS);
}

/** Whole days from `from` to the ISO date `to` (negative when `to` is in the past). */
export function daysUntil(to: string | Date | null | undefined, from: Date): number | null {
  if (!to) return null;
  const target = typeof to === 'string' ? new Date(`${to.slice(0, 10)}T00:00:00Z`) : to;
  if (Number.isNaN(target.getTime())) return null;
  return utcDay(target) - utcDay(from);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown date';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
