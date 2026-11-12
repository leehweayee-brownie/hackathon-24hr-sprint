import { CIDB_GRADES, minGradeForValue, shortMyr } from '@vp/rules';
import { DEFAULT_REQUIRED_DOC_TYPES, DocType, type BriefParseResult, type TenderRequirements } from '@vp/shared';
import { z } from 'zod';

/**
 * Deterministic brief reader. Used when no AI provider can read the brief (offline mock),
 * and to fill derived values (minimum grade, default cover) after the AI drafts the requirements.
 */

const STATES = [
  'Kuala Lumpur', 'Selangor', 'Johor', 'Penang', 'Pulau Pinang', 'Perak', 'Pahang', 'Kedah', 'Kelantan', 'Terengganu',
  'Negeri Sembilan', 'Melaka', 'Malacca', 'Sabah', 'Sarawak', 'Perlis', 'Putrajaya', 'Labuan',
];

const SCOPES: Array<[RegExp, string]> = [
  [/\bbuilding\b|\bconstruction of\b/i, 'Building works'],
  [/earthwork/i, 'Earthworks'],
  [/drainage|culvert/i, 'Drainage works'],
  [/\broad|pavement|highway/i, 'Road works'],
  [/landscap/i, 'Landscaping'],
  [/\bM&E\b|mechanical|electrical/i, 'M&E works'],
  [/fit-?out|renovation|refurbish/i, 'Fit-out works'],
  [/\bcivil\b|bridge|structural/i, 'Civil works'],
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** "RM7M", "RM 7 million", "RM750k", "RM7,000,000" → MYR. */
export function parseMoney(num: string, unit?: string): number | null {
  const n = Number(num.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const u = (unit ?? '').toLowerCase();
  if (u.startsWith('b')) return Math.round(n * 1_000_000_000);
  if (u.startsWith('m')) return Math.round(n * 1_000_000);
  if (u === 'k') return Math.round(n * 1_000);
  return Math.round(n);
}

export function parseBrief(text: string, defaults: { minLiabilityCoverage: number | null } = { minLiabilityCoverage: null }): BriefParseResult {
  const t = text.replace(/\s+/g, ' ').trim();
  const assumptions: string[] = [];

  // Money: the amount next to liability / insurance / cover is the cover, the first other amount is the value.
  let contractValue: number | null = null;
  let minLiabilityCoverage: number | null = null;
  for (const m of t.matchAll(/RM\s?([\d][\d,]*(?:\.\d+)?)\s?(billion|bil|million|mil|m|k)?\b/gi)) {
    const amount = parseMoney(m[1], m[2]);
    if (amount === null) continue;
    const before = t.slice(Math.max(0, (m.index ?? 0) - 45), m.index).toLowerCase();
    if (/liabilit|insur|cover|\bpl\b/.test(before)) minLiabilityCoverage ??= amount;
    else contractValue ??= amount;
  }

  const gradeMatch = t.match(/\bG\s?([1-7])\b/i);
  let minCidbGrade = gradeMatch ? `G${gradeMatch[1]}` : null;
  if (!minCidbGrade && contractValue) {
    minCidbGrade = minGradeForValue(contractValue);
    if (minCidbGrade) assumptions.push(`CIDB ${minCidbGrade} or higher, derived from ${shortMyr(contractValue)}`);
  }
  if (minLiabilityCoverage === null && defaults.minLiabilityCoverage) {
    minLiabilityCoverage = defaults.minLiabilityCoverage;
    assumptions.push(`Public liability ≥ ${shortMyr(defaults.minLiabilityCoverage)} from your organisation settings`);
  }

  // Dates: ISO dates first, else "Feb 2027 – Jan 2028" month ranges.
  let startDate: string | null = null;
  let endDate: string | null = null;
  const iso = [...t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)].map((m) => m[0]);
  if (iso.length) {
    startDate = iso[0];
    endDate = iso.length > 1 ? iso[iso.length - 1] : null;
  } else {
    const months = [...t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/gi)].map((m) => ({
      y: Number(m[2]),
      m: MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)),
    }));
    if (months.length) {
      const first = months[0];
      startDate = `${first.y}-${pad(first.m + 1)}-01`;
      if (months.length > 1) {
        const last = months[months.length - 1];
        endDate = `${last.y}-${pad(last.m + 1)}-${pad(lastDay(last.y, last.m))}`;
      }
    }
  }

  const location = STATES.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(t)) ?? null;
  const scope = SCOPES.find(([re]) => re.test(t))?.[1] ?? 'General works';

  const docs = new Set<DocType>(DEFAULT_REQUIRED_DOC_TYPES);
  const notes: string[] = [];
  const isoStd = t.match(/\bISO\s?(\d{4,5})/i);
  if (isoStd || /\bISO\b/i.test(t)) {
    docs.add(DocType.ISO);
    notes.push(isoStd ? `ISO ${isoStd[1]}` : 'ISO certification');
  }
  if (/bank\s+(reference|letter)/i.test(t)) docs.add(DocType.BANK_REFERENCE);

  const titleMatch = t.match(/(?:title|tender|project)\s*:\s*([^.;\n]{3,100})/i);
  const firstSentence = t.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
  const title = titleMatch?.[1].trim() ?? (firstSentence.length <= 90 ? firstSentence : [scope, location].filter(Boolean).join(', '));

  const requirements: TenderRequirements = {
    title: title || scope,
    scope,
    contractValue,
    location,
    startDate,
    endDate,
    minCidbGrade,
    minLiabilityCoverage,
    requiredDocTypes: [...docs],
    notes,
  };
  return { requirements, source: 'parser', assumptions };
}

/** Shape the AI must return, and the shape the shortlist endpoint accepts. */
export const tenderRequirementsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(120),
  contractValue: z.number().nonnegative().nullable(),
  location: z.string().trim().max(80).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  minCidbGrade: z.enum(CIDB_GRADES as [string, ...string[]]).nullable(),
  minLiabilityCoverage: z.number().nonnegative().nullable(),
  requiredDocTypes: z.array(z.nativeEnum(DocType)).max(10),
  notes: z.array(z.string().max(200)).max(10),
});

export function briefPrompt(text: string | null): string {
  return [
    'You turn a construction tender brief from a Malaysian buyer into structured requirements.',
    'Only use facts the brief states. Use null when the brief does not say.',
    'Reply with ONLY a JSON object with these keys:',
    '- title: short tender title',
    '- scope: work category, e.g. "Building works", "Earthworks", "Landscaping"',
    '- contractValue: number in MYR (e.g. 7000000), or null',
    '- location: Malaysian state or city, or null',
    '- startDate, endDate: contract period as YYYY-MM-DD (first / last day of the month when only a month is given), or null',
    '- minCidbGrade: "G1".."G7" when the brief states a grade, else null',
    '- minLiabilityCoverage: minimum public liability cover in MYR, or null',
    `- requiredDocTypes: array from ${Object.values(DocType).filter((d) => d !== DocType.OTHER).join(', ')} that the brief asks for`,
    '  (SSM company registration, CIDB certificate, PUBLIC_LIABILITY insurance, WORKMEN_COMP SOCSO cover, TAX_CLEARANCE, BANK_REFERENCE letter, ISO certificate)',
    '- notes: other must-haves as short phrases, e.g. "ISO 9001"',
    text ? `\nBrief:\n"""\n${text.slice(0, 8000)}\n"""` : '\nThe brief is the attached RFQ document.',
  ].join('\n');
}
