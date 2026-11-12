const DAY_MS = 86_400_000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toIsoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Parses a YYYY-MM-DD string into a UTC date (what Prisma's @db.Date expects). */
export function fromIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const TOKEN_RE = /\{\{today(?:([+-]\d+)d)?(?::([^}]+))?\}\}/g;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatUtc(date: Date, fmt: string): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  switch (fmt) {
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
      return `${y}-${pad(m + 1)}-${pad(d)}`;
  }
}

/**
 * Resolves relative date tokens used by recorded extractions (same grammar as fixtures/relative-dates.ts):
 * `{{today}}`, `{{today+23d}}`, `{{today-60d}}`, `{{today+23d:dd/MM/yyyy}}`. "Today" is the current UTC date.
 * Strings without tokens pass through unchanged.
 */
export function resolveRelativeDate(value: string | null | undefined, now = new Date()): string | null {
  if (value === null || value === undefined) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return value.replace(TOKEN_RE, (_m, offset: string | undefined, fmt: string | undefined) =>
    formatUtc(addDays(today, offset ? parseInt(offset, 10) : 0), fmt ?? 'yyyy-MM-dd'),
  );
}
