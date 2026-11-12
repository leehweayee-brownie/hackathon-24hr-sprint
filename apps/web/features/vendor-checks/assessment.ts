import { DocType, DocumentStatus, RuleCode, Severity, type Finding, type VendorCheckView } from '@vp/shared';
import { formatMoney } from '@/utils/format';

/**
 * Turns a vendor check's rule-engine findings into the review page's summary:
 * a recommendation, strengths, watch-outs and an approval checklist.
 * Nothing here is invented; every line comes from the findings, documents and required types.
 */

export type CheckState = 'passed' | 'condition' | 'monitor' | 'failed';
export type Verdict = 'approve' | 'approve_with_conditions' | 'request_documents' | 'do_not_approve';

export interface ChecklistItem {
  key: string;
  title: string;
  detail: string;
  state: CheckState;
  /** First evidence document, when a finding points at one. */
  documentId: string | null;
}

export interface Assessment {
  verdict: Verdict;
  headline: string;
  summary: string;
  strengths: string[];
  watchOuts: string[];
  checklist: ChecklistItem[];
  passed: number;
  requiredCount: number;
  presentCount: number;
}

const SEVERITY_RANK: Record<Severity, number> = { [Severity.CRITICAL]: 3, [Severity.WARNING]: 2, [Severity.INFO]: 1 };
const STATE_FOR: Record<Severity, CheckState> = { [Severity.CRITICAL]: 'failed', [Severity.WARNING]: 'condition', [Severity.INFO]: 'monitor' };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function assessCheck(check: VendorCheckView): Assessment {
  const findings = [...(check.findings ?? [])].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const documents = (check.documents ?? []).filter((d) => !d.supersededById);
  const required = check.requiredDocTypes ?? [];
  const present = new Set(documents.map((d) => d.docType));
  const presentCount = required.filter((t) => present.has(t)).length;
  const verified = documents.filter((d) => d.status === DocumentStatus.VERIFIED).length;
  const has = (...rules: RuleCode[]) => findings.filter((f) => rules.includes(f.rule));

  const groups: Array<{ key: string; title: string; rules: RuleCode[]; pass: string }> = [
    { key: 'documents', title: 'Mandatory documents', rules: [RuleCode.REQUIRED_DOCUMENT_MISSING], pass: `${presentCount} of ${required.length} present` },
    {
      key: 'identity',
      title: 'Company identity',
      rules: [RuleCode.COMPANY_NAME_MISMATCH, RuleCode.REGISTRATION_NO_MISMATCH],
      pass: 'Name and SSM number agree across documents',
    },
    { key: 'cidb', title: 'CIDB grade', rules: [RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE], pass: `Grade covers the ${formatMoney(check.contractValue)} contract` },
    { key: 'validity', title: 'Document validity', rules: [RuleCode.DOCUMENT_EXPIRED, RuleCode.DOCUMENT_EXPIRING_SOON], pass: 'Nothing expired or expiring within 30 days' },
    { key: 'insurance', title: 'Insurance coverage', rules: [RuleCode.COVERAGE_BELOW_MINIMUM], pass: 'Cover meets the minimum for this tender' },
    {
      key: 'fields',
      title: 'Extracted values confirmed',
      rules: [RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD],
      pass: 'Every value was read with high confidence or confirmed',
    },
  ];

  const checklist: ChecklistItem[] = groups.map((g) => {
    const hits = has(...g.rules);
    if (hits.length === 0) return { key: g.key, title: g.title, detail: g.pass, state: 'passed', documentId: null };
    const worst = hits[0];
    return {
      key: g.key,
      title: g.title,
      detail: hits.length > 1 ? `${worst.message} (+${hits.length - 1} more)` : worst.message,
      state: STATE_FOR[worst.severity],
      documentId: hits.flatMap((f) => f.documentIds)[0] ?? null,
    };
  });
  const passed = checklist.filter((c) => c.state === 'passed').length;

  const critical = findings.filter((f) => f.severity === Severity.CRITICAL);
  const warnings = findings.filter((f) => f.severity === Severity.WARNING);
  const infos = findings.filter((f) => f.severity === Severity.INFO);
  const docsLine = required.length > 0 ? `${presentCount} of ${required.length} required documents are on file.` : `${plural(documents.length, 'document')} on file.`;
  const describe = (list: Finding[]) => list.map((f) => f.message.replace(/\.$/, '')).slice(0, 2).join('; ');

  let verdict: Verdict;
  let headline: string;
  let summary: string;
  if (critical.length > 0) {
    const missingOrExpired = critical.every((f) => f.rule === RuleCode.REQUIRED_DOCUMENT_MISSING || f.rule === RuleCode.DOCUMENT_EXPIRED);
    verdict = missingOrExpired ? 'request_documents' : 'do_not_approve';
    headline = missingOrExpired ? 'Request more documents' : 'Do not approve yet';
    summary = `${docsLine} ${plural(critical.length, 'critical issue')} must be resolved first: ${describe(critical)}.`;
  } else if (warnings.length + infos.length > 0) {
    verdict = 'approve_with_conditions';
    const conditions = warnings.length || infos.length;
    headline = warnings.length > 0 ? `Approve with ${plural(conditions, 'condition')}` : `Approve and monitor ${plural(conditions, 'item')}`;
    summary = `${docsLine} No critical issues. ${warnings.length > 0 ? `Approve on condition that ${describe(warnings).charAt(0).toLowerCase()}${describe(warnings).slice(1)} is resolved.` : `Keep an eye on: ${describe(infos)}.`}`;
  } else {
    verdict = 'approve';
    headline = 'Approve';
    summary = `${docsLine} Every rule passed and the documents agree with each other.`;
  }

  const strengths: string[] = [];
  if (required.length > 0 && presentCount === required.length) strengths.push(`${required.length} of ${required.length} required documents on file`);
  if (verified > 0) strengths.push(`${verified} of ${documents.length} documents verified`);
  if (checklist.find((c) => c.key === 'identity')?.state === 'passed' && documents.length > 0) strengths.push('Company name and SSM number agree across documents');
  if (checklist.find((c) => c.key === 'cidb')?.state === 'passed' && present.has(DocType.CIDB)) strengths.push(`CIDB grade covers the ${formatMoney(check.contractValue)} contract`);
  if (has(RuleCode.DOCUMENT_EXPIRED).length === 0 && documents.length > 0) strengths.push('No expired documents');

  const watchOuts = findings.map((f) => f.message);

  return { verdict, headline, summary, strengths: strengths.slice(0, 4), watchOuts, checklist, passed, requiredCount: required.length, presentCount };
}
