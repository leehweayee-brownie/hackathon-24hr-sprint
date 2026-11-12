import type { FieldKind } from '@vp/shared';

const COMPANY_SUFFIX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bSENDIRIAN\s+BERHAD\b/g, 'SDN BHD'],
  [/\bSDN\.?\s*BHD\.?/g, 'SDN BHD'],
  [/\bSENDIRIAN\b/g, 'SDN'],
  [/\bBERHAD\b/g, 'BHD'],
  [/\bPRIVATE\s+LIMITED\b/g, 'SDN BHD'],
  [/\bPTE\.?\s*LTD\.?/g, 'SDN BHD'],
  [/\bLIMITED\b/g, 'LTD'],
  [/\bCOMPANY\b/g, 'CO'],
  [/\bAND\b/g, '&'],
];

/**
 * Normalizes a company name so that only real differences remain:
 * case, punctuation, extra spaces and "Sdn. Bhd." vs "Sendirian Berhad" are not differences.
 */
export function normalizeCompanyName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.toUpperCase();
  s = s.replace(/[’'`"]/g, '');
  s = s.replace(/[.,;:()\[\]{}\-_/\\]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  for (const [re, rep] of COMPANY_SUFFIX_REPLACEMENTS) s = s.replace(re, rep);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Normalizes a registration number into a canonical, comparable token.
 * "1234567-X" → "1234567X", "2020 0101 2345" → "202001012345".
 */
export function normalizeRegistrationNo(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extracts every registration-number-like token from a string.
 * SSM documents often print both the new 12-digit number and the old number: "202001012345 (1234567-X)".
 */
export function registrationNoTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const tokens = raw
    .toUpperCase()
    .split(/[\s,;/()|]+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ''))
    .filter((t) => t.length >= 6 && /\d/.test(t));
  if (tokens.length === 0) {
    // Numbers printed with spaces inside ("2015 0102 3456") collapse into one token.
    const whole = normalizeRegistrationNo(raw);
    if (whole.length >= 6 && /\d/.test(whole)) tokens.push(whole);
  }
  return Array.from(new Set(tokens));
}

/** True when two registration number strings share at least one token. */
export function registrationNosMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = registrationNoTokens(a);
  const tb = registrationNoTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  return ta.some((t) => tb.includes(t));
}

const MONTHS: Record<string, number> = {
  JAN: 1, JANUARY: 1, JANUARI: 1,
  FEB: 2, FEBRUARY: 2, FEBRUARI: 2,
  MAR: 3, MARCH: 3, MAC: 3,
  APR: 4, APRIL: 4,
  MAY: 5, MEI: 5,
  JUN: 6, JUNE: 6,
  JUL: 7, JULY: 7, JULAI: 7,
  AUG: 8, AUGUST: 8, OGOS: 8, OGO: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9,
  OCT: 10, OCTOBER: 10, OKT: 10, OKTOBER: 10,
  NOV: 11, NOVEMBER: 11,
  DEC: 12, DECEMBER: 12, DIS: 12, DISEMBER: 12,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parses the date formats found on Malaysian documents into an ISO date (YYYY-MM-DD).
 * Supports ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "12 March 2026", "12 Mac 2026", "March 12, 2026".
 * Day-first is assumed for numeric dates. Returns null when the value cannot be read.
 */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return isoDate(+m[3], +m[2], +m[1]);

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (m) return isoDate(2000 + +m[3], +m[2], +m[1]);

  m = s.match(/^(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/i);
  if (m) {
    const month = MONTHS[m[2].toUpperCase()];
    return month ? isoDate(+m[3], month, +m[1]) : null;
  }

  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:ST|ND|RD|TH)?,?\s+(\d{4})$/i);
  if (m) {
    const month = MONTHS[m[1].toUpperCase()];
    return month ? isoDate(+m[3], month, +m[2]) : null;
  }

  m = s.match(/^(\d{1,2})\s*[\/\-]\s*([A-Za-z]{3,})\s*[\/\-]\s*(\d{4})$/i);
  if (m) {
    const month = MONTHS[m[2].toUpperCase()];
    return month ? isoDate(+m[3], month, +m[1]) : null;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/**
 * Parses a money amount into a number. "RM 1,000,000.00" → 1000000, "MYR 1.5 million" → 1500000.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/(RM|MYR|RINGGIT|MALAYSIA|USD|\$)/g, ' ').trim();
  const m = s.match(/(-?\d[\d,]*(?:\.\d+)?)\s*(MILLION|JUTA|MIL|M|THOUSAND|RIBU|K|BILLION|BILION|BN|B)?\b/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(value)) return null;
  const unit = m[2] ?? '';
  let multiplier = 1;
  if (['MILLION', 'JUTA', 'MIL', 'M'].includes(unit)) multiplier = 1_000_000;
  else if (['THOUSAND', 'RIBU', 'K'].includes(unit)) multiplier = 1_000;
  else if (['BILLION', 'BILION', 'BN', 'B'].includes(unit)) multiplier = 1_000_000_000;
  return Math.round(value * multiplier * 100) / 100;
}

/** Normalizes a CIDB grade: "Gred G7", "g 7", "G-7" → "G7". */
export function normalizeGrade(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/G\s*[-]?\s*([1-7])\b/);
  return m ? `G${m[1]}` : null;
}

/** Normalizes a list field ("B, CE; ME") into a comma-separated canonical form. */
export function normalizeList(raw: string | null | undefined): string {
  if (!raw) return '';
  return Array.from(
    new Set(
      raw
        .split(/[,;/|\n]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).join(', ');
}

/** Applies the normalizer for a field kind. Returns null when the value cannot be normalized. */
export function normalizeValue(kind: FieldKind, raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  switch (kind) {
    case 'company_name':
      return normalizeCompanyName(raw) || null;
    case 'registration_no':
      return registrationNoTokens(raw).join(' ') || normalizeRegistrationNo(raw) || null;
    case 'date':
      return parseDate(raw);
    case 'amount': {
      const n = parseAmount(raw);
      return n === null ? null : String(n);
    }
    case 'grade':
      return normalizeGrade(raw);
    case 'list':
      return normalizeList(raw) || null;
    default:
      return raw.replace(/\s+/g, ' ').trim() || null;
  }
}

export function formatMyr(amount: number): string {
  return `RM${amount.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;
}
