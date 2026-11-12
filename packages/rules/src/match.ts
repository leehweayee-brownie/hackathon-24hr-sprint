import { DOC_TYPE_DEFINITIONS, DocType, RuleCode, type MatchFit, type MatchGap, type TenderRequirements } from '@vp/shared';
import { CIDB_GRADES, CIDB_GRADE_LIMITS, isCidbGrade, type CidbGrade } from './config/cidb-grades';
import { runCrossChecks } from './cross-check';
import { parseAmount } from './normalize';
import type { RuleDocument } from './types';

/**
 * Vendor Match: decides whether a supplier fits a tender from verified document facts only.
 * Deterministic, like the rest of the rules engine: the AI drafts the requirements, this decides the fit.
 *
 * - excluded:    a hard limit the supplier cannot fix for this tender (CIDB grade below the contract).
 * - conditional: fixable gaps (missing, expired or short-dated documents, cover too low, mismatched details).
 * - qualified:   nothing to fix.
 */

export interface SupplierMatchInput {
  documents: RuleDocument[];
  requirements: TenderRequirements;
  rating: { average: number | null; count: number };
  pastJobs: number;
  now?: Date;
}

export interface SupplierMatchResult {
  fit: MatchFit;
  summary: string;
  strengths: string[];
  gaps: MatchGap[];
  cidbGrade: string | null;
  liabilityCover: number | null;
  location: string | null;
}

/** Lowest CIDB grade allowed to take a contract of this value. */
export function minGradeForValue(value: number | null | undefined): CidbGrade | null {
  if (!value || value <= 0) return null;
  return CIDB_GRADES.find((g) => {
    const max = CIDB_GRADE_LIMITS[g].maxContractValue;
    return max === null || max >= value;
  }) ?? 'G7';
}

/** "RM7M", "RM750k", "RM950,000". */
export function shortMyr(value: number): string {
  if (value >= 1_000_000) return `RM${Number((value / 1_000_000).toFixed(1)).toString()}M`;
  if (value >= 10_000) return `RM${Math.round(value / 1_000)}k`;
  return `RM${value.toLocaleString('en-MY')}`;
}

const gradeRank = (g: string) => CIDB_GRADES.indexOf(g as CidbGrade);
/** Lower-case the first letter unless the label starts with an acronym (SSM, LHDN, ISO). */
const lower = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));
/** "an ISO", "an SSM", "an LHDN" (acronyms by sound), "a bank reference letter". */
const withArticle = (label: string) => {
  const vowelSound = /^[A-Z]{2}/.test(label) ? /^[AEFHILMNORSX]/.test(label) : /^[aeiou]/i.test(label);
  return `${vowelSound ? 'an' : 'a'} ${label}`;
};
const field = (d: RuleDocument | undefined, key: string) => d?.fields[key]?.value ?? null;

/** What the supplier has to do to close a gap, used in "Qualifies if they …". */
function action(gap: MatchGap): string {
  const label = gap.docType ? lower(DOC_TYPE_DEFINITIONS[gap.docType].label) : 'the document';
  switch (gap.kind) {
    case 'missing_document':
      return `submit ${withArticle(label)}`;
    case 'expired':
      return `renew their ${label}`;
    case 'expires_before_end':
      return `renew their ${label} to cover the contract`;
    case 'cover_below_minimum':
      return 'raise their public liability cover';
    case 'identity_mismatch':
      return 'correct the company details on their documents';
    default:
      return 'meet the grade';
  }
}

export function matchSupplier(input: SupplierMatchInput): SupplierMatchResult {
  const { requirements: req } = input;
  const now = input.now ?? new Date();
  const active = input.documents.filter((d) => !d.supersededById);
  const latest = (type: DocType) =>
    active.filter((d) => d.docType === type).sort((a, b) => (b.expiresAt ?? '').localeCompare(a.expiresAt ?? ''))[0];

  const cidb = latest(DocType.CIDB);
  const liability = latest(DocType.PUBLIC_LIABILITY);
  const ssm = latest(DocType.SSM);
  const grade = field(cidb, 'grade');
  const cover = parseAmount(field(liability, 'coverage_amount'));
  const location = field(ssm, 'registered_address');
  const minGrade = req.minCidbGrade ?? minGradeForValue(req.contractValue);
  const end = req.endDate ? new Date(`${req.endDate}T00:00:00`) : null;

  const gaps: MatchGap[] = [];

  // Hard limit: the grade the CIDB certificate shows. Without a certificate it is a document to request.
  if (minGrade && cidb && isCidbGrade(grade) && gradeRank(grade) < gradeRank(minGrade)) {
    const max = CIDB_GRADE_LIMITS[grade].maxContractValue;
    gaps.push({
      kind: 'grade_below',
      docType: DocType.CIDB,
      message: max !== null ? `${grade} caps at ${shortMyr(max)}, so they're excluded for this tender` : `${grade} is below the ${minGrade} this tender needs`,
      requestable: false,
    });
  }

  const required = Array.from(new Set([...(req.requiredDocTypes ?? []), ...(minGrade ? [DocType.CIDB] : [])]));
  for (const type of required) {
    const doc = latest(type);
    const label = DOC_TYPE_DEFINITIONS[type].label;
    if (!doc) {
      gaps.push({ kind: 'missing_document', docType: type, message: `No ${lower(label)} on file`, requestable: true });
      continue;
    }
    const expires = doc.expiresAt ? new Date(`${doc.expiresAt.slice(0, 10)}T00:00:00`) : null;
    if (expires && expires < now) {
      gaps.push({ kind: 'expired', docType: type, message: `${label} expired on ${doc.expiresAt!.slice(0, 10)}`, requestable: true });
    } else if (expires && end && expires < end) {
      gaps.push({ kind: 'expires_before_end', docType: type, message: `${label} expires ${doc.expiresAt!.slice(0, 10)}, before the contract ends`, requestable: true });
    }
  }

  if (req.minLiabilityCoverage && liability && cover !== null && cover < req.minLiabilityCoverage) {
    gaps.push({
      kind: 'cover_below_minimum',
      docType: DocType.PUBLIC_LIABILITY,
      message: `Public liability cover ${shortMyr(cover)} is below the ${shortMyr(req.minLiabilityCoverage)} required`,
      requestable: true,
    });
  }

  const identity = runCrossChecks({ documents: input.documents, now }).filter(
    (f) => f.rule === RuleCode.COMPANY_NAME_MISMATCH || f.rule === RuleCode.REGISTRATION_NO_MISMATCH,
  );
  if (identity.length > 0) {
    gaps.push({ kind: 'identity_mismatch', docType: null, message: identity[0].message, requestable: true });
  }

  const fit: MatchFit = gaps.some((g) => g.kind === 'grade_below') ? 'excluded' : gaps.length > 0 ? 'conditional' : 'qualified';

  // Strengths: only facts read from verified documents, ratings and past jobs.
  const strengths: string[] = [];
  if (isCidbGrade(grade)) strengths.push(grade);
  if (liability?.expiresAt) {
    const liabEnd = new Date(`${liability.expiresAt.slice(0, 10)}T00:00:00`);
    if (liabEnd >= now && (!end || liabEnd >= end)) strengths.push(end ? 'insurance valid for the whole contract' : `insurance valid to ${liability.expiresAt.slice(0, 10)}`);
  }
  if (cover !== null && (!req.minLiabilityCoverage || cover >= req.minLiabilityCoverage)) strengths.push(`${shortMyr(cover)} liability cover`);
  const iso = latest(DocType.ISO);
  const standard = field(iso, 'standard');
  if (iso && standard) strengths.push(standard.replace(/:\d{4}$/, ''));
  if (input.rating.count > 0 && input.rating.average !== null) {
    strengths.push(`rated ${input.rating.average.toFixed(1)} from ${input.rating.count} past ${input.rating.count === 1 ? 'job' : 'jobs'}`);
  } else if (input.pastJobs > 0) {
    strengths.push(`${input.pastJobs} past ${input.pastJobs === 1 ? 'job' : 'jobs'} approved`);
  }
  // Location is a soft signal: "Shah Alam, Selangor" matches an address in Kajang, Selangor on the state.
  const place = req.location && location ? req.location.split(/,\s*/).reverse().find((p) => p && location.toLowerCase().includes(p.toLowerCase())) : null;
  if (place) strengths.push(`based in ${place}`);

  let summary: string;
  if (fit === 'excluded') {
    const hard = gaps.find((g) => g.kind === 'grade_below')!;
    summary = `${hard.message}.`;
  } else if (fit === 'conditional') {
    const actions = Array.from(new Set(gaps.map(action)));
    const shown = actions.slice(0, 2);
    const more = actions.length - shown.length;
    const list = more > 0 ? `${shown.join(', ')} and ${more} more` : shown.length > 1 ? `${shown[0]} and ${shown[1]}` : shown[0];
    summary = `Qualifies if they ${list}.`;
  } else {
    summary = strengths.length > 0 ? `${strengths.join(', ')}.` : 'Meets every requirement.';
  }

  return { fit, summary, strengths, gaps, cidbGrade: isCidbGrade(grade) ? grade : null, liabilityCover: cover, location };
}

type Rankable = { fit: MatchFit; gaps?: unknown[]; rating: { average: number | null; count: number }; trustScore: number | null; pastJobs: number };

/** Sort order for the shortlist: fit, then fewest gaps to close, then rating, trust score and experience. */
export function compareMatches(a: Rankable, b: Rankable): number {
  const order: Record<MatchFit, number> = { qualified: 0, conditional: 1, excluded: 2 };
  return (
    order[a.fit] - order[b.fit] ||
    (a.gaps?.length ?? 0) - (b.gaps?.length ?? 0) ||
    (b.rating.average ?? 0) - (a.rating.average ?? 0) ||
    b.rating.count - a.rating.count ||
    (b.trustScore ?? 0) - (a.trustScore ?? 0) ||
    b.pastJobs - a.pastJobs
  );
}
