import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_EXPIRY_WARNING_DAYS,
  DEFAULT_REQUIRED_DOC_TYPES,
  DEFAULT_RULE_WEIGHTS,
  DOC_TYPE_DEFINITIONS,
  DocType,
  DocumentStatus,
  Finding,
  RuleCode,
  RuleWeights,
  Severity,
  docTypeLabel,
  fieldLabel,
} from '@vp/shared';
import { gradeAllowsContract, cidbGradeLimit } from './config/cidb-grades';
import { daysUntil, formatDate } from './dates';
import { formatMyr, normalizeCompanyName, normalizeGrade, parseAmount, registrationNosMatch } from './normalize';
import type { ResolvedRuleContext, RuleContext, RuleDocument } from './types';

const ACTIVE_STATUSES: DocumentStatus[] = [DocumentStatus.NEEDS_REVIEW, DocumentStatus.VERIFIED];

export function resolveContext(ctx: RuleContext): ResolvedRuleContext {
  const activeDocuments = ctx.documents.filter(
    (d) => !d.supersededById && ACTIVE_STATUSES.includes(d.status),
  );
  return {
    documents: ctx.documents,
    activeDocuments,
    now: ctx.now ?? new Date(),
    contractValue: ctx.contractValue ?? null,
    requiredDocTypes: ctx.requiredDocTypes && ctx.requiredDocTypes.length > 0 ? ctx.requiredDocTypes : DEFAULT_REQUIRED_DOC_TYPES,
    minLiabilityCoverage: ctx.minLiabilityCoverage ?? null,
    weights: { ...DEFAULT_RULE_WEIGHTS, ...(ctx.weights ?? {}) } as RuleWeights,
    confidenceThreshold: ctx.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    expiryWarningDays: ctx.expiryWarningDays ?? DEFAULT_EXPIRY_WARNING_DAYS,
  };
}

function fieldValue(doc: RuleDocument, key: string): string | null {
  return doc.fields[key]?.value ?? null;
}

/** The company name a document claims: insured party for insurance, company name otherwise. */
export function documentCompanyName(doc: RuleDocument): string | null {
  if (doc.docType === DocType.PUBLIC_LIABILITY || doc.docType === DocType.WORKMEN_COMP) {
    return fieldValue(doc, 'insured_party') ?? fieldValue(doc, 'company_name');
  }
  return fieldValue(doc, 'company_name');
}

export function companyNameRule(ctx: ResolvedRuleContext): Finding[] {
  const docs = ctx.activeDocuments.filter((d) => d.docType !== DocType.OTHER);
  const ssm = docs.find((d) => d.docType === DocType.SSM && documentCompanyName(d));
  let referenceName: string | null;
  let referenceDoc: RuleDocument | null;
  if (ssm) {
    referenceName = documentCompanyName(ssm);
    referenceDoc = ssm;
  } else {
    // No SSM: use the most common name as the reference.
    const counts = new Map<string, { n: number; doc: RuleDocument }>();
    for (const d of docs) {
      const name = normalizeCompanyName(documentCompanyName(d));
      if (!name) continue;
      const cur = counts.get(name);
      counts.set(name, { n: (cur?.n ?? 0) + 1, doc: cur?.doc ?? d });
    }
    const best = Array.from(counts.values()).sort((a, b) => b.n - a.n)[0];
    if (!best) return [];
    referenceName = documentCompanyName(best.doc);
    referenceDoc = best.doc;
  }
  const ref = normalizeCompanyName(referenceName);
  if (!ref) return [];
  const findings: Finding[] = [];
  for (const d of docs) {
    if (d.id === referenceDoc?.id) continue;
    const raw = documentCompanyName(d);
    const name = normalizeCompanyName(raw);
    if (!name || name === ref) continue;
    findings.push({
      rule: RuleCode.COMPANY_NAME_MISMATCH,
      severity: Severity.WARNING,
      message: `${docTypeLabel(d.docType)} names "${raw}", but ${docTypeLabel(referenceDoc!.docType)} says "${referenceName}"`,
      deduction: ctx.weights[RuleCode.COMPANY_NAME_MISMATCH],
      documentIds: [d.id, referenceDoc!.id],
      meta: { found: raw, expected: referenceName, docType: d.docType, referenceDocType: referenceDoc!.docType },
    });
  }
  return findings;
}

export function registrationNoRule(ctx: ResolvedRuleContext): Finding[] {
  const ssm = ctx.activeDocuments.find((d) => d.docType === DocType.SSM && fieldValue(d, 'registration_no'));
  if (!ssm) return [];
  const ref = fieldValue(ssm, 'registration_no');
  const findings: Finding[] = [];
  for (const d of ctx.activeDocuments) {
    if (d.id === ssm.id || d.docType === DocType.OTHER) continue;
    const value = fieldValue(d, 'registration_no');
    if (!value) continue;
    if (registrationNosMatch(value, ref)) continue;
    findings.push({
      rule: RuleCode.REGISTRATION_NO_MISMATCH,
      severity: Severity.CRITICAL,
      message: `SSM number on the ${docTypeLabel(d.docType)} (${value}) does not match the SSM certificate (${ref})`,
      deduction: ctx.weights[RuleCode.REGISTRATION_NO_MISMATCH],
      documentIds: [d.id, ssm.id],
      meta: { found: value, expected: ref, docType: d.docType },
    });
  }
  return findings;
}

export function cidbGradeRule(ctx: ResolvedRuleContext): Finding[] {
  if (ctx.contractValue === null || ctx.contractValue === undefined) return [];
  const cidb = ctx.activeDocuments.find((d) => d.docType === DocType.CIDB && fieldValue(d, 'grade'));
  if (!cidb) return [];
  const grade = normalizeGrade(fieldValue(cidb, 'grade'));
  if (gradeAllowsContract(grade, ctx.contractValue)) return [];
  const limit = cidbGradeLimit(grade);
  const limitText = limit === undefined ? 'an unrecognised grade' : limit === null ? 'no limit' : formatMyr(limit);
  return [
    {
      rule: RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE,
      severity: Severity.CRITICAL,
      message: grade
        ? `CIDB grade ${grade} allows contracts up to ${limitText}, below this tender's value of ${formatMyr(ctx.contractValue)}`
        : `CIDB grade could not be read, so it cannot be checked against this tender's value of ${formatMyr(ctx.contractValue)}`,
      deduction: ctx.weights[RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE],
      documentIds: [cidb.id],
      meta: { grade, limit: limit ?? null, contractValue: ctx.contractValue },
    },
  ];
}

export function expiryRule(ctx: ResolvedRuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const d of ctx.activeDocuments) {
    if (!DOC_TYPE_DEFINITIONS[d.docType]?.hasExpiry) continue;
    const expiresAt = d.expiresAt ?? fieldValue(d, 'expiry_date');
    const days = daysUntil(expiresAt, ctx.now);
    if (days === null) continue;
    const label = docTypeLabel(d.docType);
    if (days < 0) {
      findings.push({
        rule: RuleCode.DOCUMENT_EXPIRED,
        severity: Severity.CRITICAL,
        message: `${label} expired on ${formatDate(expiresAt)} (${-days} day${days === -1 ? '' : 's'} ago)`,
        deduction: ctx.weights[RuleCode.DOCUMENT_EXPIRED],
        documentIds: [d.id],
        meta: { expiresAt, daysToExpiry: days, docType: d.docType },
      });
    } else if (days <= ctx.expiryWarningDays) {
      findings.push({
        rule: RuleCode.DOCUMENT_EXPIRING_SOON,
        severity: Severity.WARNING,
        message:
          days === 0
            ? `${label} expires today`
            : `${label} expires in ${days} day${days === 1 ? '' : 's'} (${formatDate(expiresAt)})`,
        deduction: ctx.weights[RuleCode.DOCUMENT_EXPIRING_SOON],
        documentIds: [d.id],
        meta: { expiresAt, daysToExpiry: days, docType: d.docType },
      });
    }
  }
  return findings;
}

export function requiredDocumentsRule(ctx: ResolvedRuleContext): Finding[] {
  const present = new Set(ctx.activeDocuments.map((d) => d.docType));
  return ctx.requiredDocTypes
    .filter((t) => !present.has(t))
    .map((t) => ({
      rule: RuleCode.REQUIRED_DOCUMENT_MISSING,
      severity: Severity.CRITICAL,
      message: `${docTypeLabel(t)} is required but has not been provided`,
      deduction: ctx.weights[RuleCode.REQUIRED_DOCUMENT_MISSING],
      documentIds: [],
      meta: { docType: t },
    }));
}

export function coverageRule(ctx: ResolvedRuleContext): Finding[] {
  if (!ctx.minLiabilityCoverage) return [];
  const findings: Finding[] = [];
  for (const d of ctx.activeDocuments) {
    if (d.docType !== DocType.PUBLIC_LIABILITY) continue;
    const amount = parseAmount(fieldValue(d, 'coverage_amount'));
    if (amount === null || amount >= ctx.minLiabilityCoverage) continue;
    findings.push({
      rule: RuleCode.COVERAGE_BELOW_MINIMUM,
      severity: Severity.WARNING,
      message: `Public liability cover of ${formatMyr(amount)} is below the buyer's minimum of ${formatMyr(ctx.minLiabilityCoverage)}`,
      deduction: ctx.weights[RuleCode.COVERAGE_BELOW_MINIMUM],
      documentIds: [d.id],
      meta: { coverage: amount, minimum: ctx.minLiabilityCoverage },
    });
  }
  return findings;
}

export function lowConfidenceRule(ctx: ResolvedRuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const d of ctx.activeDocuments) {
    if (d.docType === DocType.OTHER) continue;
    const keys = Object.entries(d.fields)
      .filter(([, f]) => !f.confirmed && f.confidence < ctx.confidenceThreshold)
      .map(([key]) => key);
    if (keys.length === 0) continue;
    const labels = keys.map((k) => fieldLabel(d.docType, k));
    findings.push({
      rule: RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD,
      severity: Severity.INFO,
      message: `${keys.length} field${keys.length === 1 ? '' : 's'} on the ${docTypeLabel(d.docType)} need${keys.length === 1 ? 's' : ''} confirmation: ${labels.join(', ')}`,
      deduction: ctx.weights[RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD],
      documentIds: [d.id],
      meta: { fieldKeys: keys, docType: d.docType },
    });
  }
  return findings;
}

export const ALL_RULES = [
  companyNameRule,
  registrationNoRule,
  cidbGradeRule,
  expiryRule,
  requiredDocumentsRule,
  coverageRule,
  lowConfidenceRule,
] as const;

/** Runs every cross-check across all of a vendor's documents and returns the findings. */
export function runCrossChecks(input: RuleContext): Finding[] {
  const ctx = resolveContext(input);
  return ALL_RULES.flatMap((rule) => rule(ctx));
}
