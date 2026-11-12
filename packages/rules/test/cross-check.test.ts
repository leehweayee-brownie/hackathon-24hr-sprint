import { DocType, DocumentStatus, RuleCode, Severity } from '@vp/shared';
import { describe, expect, it } from 'vitest';
import { evaluate, runCrossChecks } from '../src';
import { NOW, binaJayaDocs, doc, field } from './helpers';

const byRule = (rule: RuleCode) => (f: { rule: RuleCode }) => f.rule === rule;

describe('cross-checks', () => {
  it('gives a clean vendor a perfect score', () => {
    const result = evaluate({ documents: binaJayaDocs(), now: NOW, contractValue: 3_000_000 });
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.band).toBe('green');
  });

  it('flags a company name mismatch between insurance and SSM', () => {
    const findings = runCrossChecks({ documents: binaJayaDocs({ insuranceName: 'Bina Jaya Engineering Sdn Bhd' }), now: NOW });
    const f = findings.filter(byRule(RuleCode.COMPANY_NAME_MISMATCH));
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('Bina Jaya Engineering Sdn Bhd');
    expect(f[0].message).toContain('Bina Jaya Sdn Bhd');
    expect(f[0].documentIds).toHaveLength(2);
    expect(f[0].deduction).toBe(20);
  });

  it('does not flag Sdn. Bhd. spelling differences', () => {
    const findings = runCrossChecks({ documents: binaJayaDocs({ insuranceName: 'BINA JAYA SENDIRIAN BERHAD' }), now: NOW });
    expect(findings.filter(byRule(RuleCode.COMPANY_NAME_MISMATCH))).toEqual([]);
  });

  it('flags a registration number mismatch against the SSM certificate', () => {
    const docs = binaJayaDocs();
    docs[1].fields.registration_no = field('201501099999');
    const f = runCrossChecks({ documents: docs, now: NOW }).filter(byRule(RuleCode.REGISTRATION_NO_MISMATCH));
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe(Severity.CRITICAL);
    expect(f[0].deduction).toBe(25);
  });

  it('accepts the old registration number as a match', () => {
    const f = runCrossChecks({ documents: binaJayaDocs(), now: NOW }).filter(byRule(RuleCode.REGISTRATION_NO_MISMATCH));
    expect(f).toEqual([]);
  });

  it('flags a CIDB grade below the contract value', () => {
    const f = runCrossChecks({ documents: binaJayaDocs({ grade: 'G5' }), now: NOW, contractValue: 8_000_000 }).filter(
      byRule(RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE),
    );
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('G5');
    expect(f[0].message).toContain('RM8,000,000');
    expect(f[0].deduction).toBe(25);
  });

  it('skips the CIDB rule when there is no contract value', () => {
    expect(runCrossChecks({ documents: binaJayaDocs({ grade: 'G1' }), now: NOW })).toEqual([]);
  });

  it('flags documents expiring within 30 days', () => {
    const f = runCrossChecks({ documents: binaJayaDocs({ insuranceExpiry: '2026-12-05' }), now: NOW }).filter(
      byRule(RuleCode.DOCUMENT_EXPIRING_SOON),
    );
    expect(f).toHaveLength(1);
    expect(f[0].message).toBe('Public liability insurance expires in 23 days (5 Dec 2026)');
    expect(f[0].deduction).toBe(10);
  });

  it('flags expired documents as critical', () => {
    const f = runCrossChecks({ documents: binaJayaDocs({ insuranceExpiry: '2026-11-01' }), now: NOW }).filter(
      byRule(RuleCode.DOCUMENT_EXPIRED),
    );
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe(Severity.CRITICAL);
    expect(f[0].deduction).toBe(30);
    expect(runCrossChecks({ documents: binaJayaDocs({ insuranceExpiry: '2026-11-01' }), now: NOW }).filter(byRule(RuleCode.DOCUMENT_EXPIRING_SOON))).toEqual([]);
  });

  it('flags missing required documents', () => {
    const docs = binaJayaDocs().filter((d) => d.docType !== DocType.TAX_CLEARANCE);
    const f = runCrossChecks({ documents: docs, now: NOW }).filter(byRule(RuleCode.REQUIRED_DOCUMENT_MISSING));
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('LHDN tax clearance');
    expect(f[0].deduction).toBe(15);
  });

  it('respects a buyer-specific required document list', () => {
    const docs = binaJayaDocs().filter((d) => d.docType !== DocType.TAX_CLEARANCE);
    const f = runCrossChecks({ documents: docs, now: NOW, requiredDocTypes: [DocType.SSM, DocType.ISO] }).filter(
      byRule(RuleCode.REQUIRED_DOCUMENT_MISSING),
    );
    expect(f.map((x) => x.meta?.docType)).toEqual([DocType.ISO]);
  });

  it('flags coverage below the buyer minimum', () => {
    const f = runCrossChecks({ documents: binaJayaDocs(), now: NOW, minLiabilityCoverage: 5_000_000 }).filter(
      byRule(RuleCode.COVERAGE_BELOW_MINIMUM),
    );
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('RM2,000,000');
  });

  it('flags unconfirmed low-confidence fields and clears them once confirmed', () => {
    const docs = binaJayaDocs();
    docs[2].fields.coverage_amount = field('2000000', 0.6);
    const before = runCrossChecks({ documents: docs, now: NOW }).filter(byRule(RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD));
    expect(before).toHaveLength(1);
    expect(before[0].deduction).toBe(5);
    expect(before[0].message).toContain('Limit of liability');
    docs[2].fields.coverage_amount = field('2000000', 0.6, true);
    expect(runCrossChecks({ documents: docs, now: NOW }).filter(byRule(RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD))).toEqual([]);
  });

  it('ignores superseded, failed and in-progress documents', () => {
    const docs = binaJayaDocs({ insuranceName: 'Wrong Name Sdn Bhd' });
    docs[2].supersededById = 'newer';
    docs.push(doc(DocType.PUBLIC_LIABILITY, { insured_party: 'Bina Jaya Sdn Bhd', expiry_date: '2027-06-01' }));
    docs.push(doc(DocType.ISO, { company_name: 'Someone Else Sdn Bhd' }, { status: DocumentStatus.EXTRACTING }));
    expect(runCrossChecks({ documents: docs, now: NOW })).toEqual([]);
  });

  it('ignores "Other" documents', () => {
    const docs = [...binaJayaDocs(), doc(DocType.OTHER, { company_name: 'Random Co', title: 'Brochure' })];
    expect(runCrossChecks({ documents: docs, now: NOW })).toEqual([]);
  });

  it('applies buyer-specific weights', () => {
    const result = evaluate({
      documents: binaJayaDocs({ insuranceName: 'Bina Jaya Engineering Sdn Bhd' }),
      now: NOW,
      weights: { [RuleCode.COMPANY_NAME_MISMATCH]: 40 },
    });
    expect(result.score).toBe(60);
    expect(result.band).toBe('amber');
  });

  it('reproduces the demo scenario', () => {
    const result = evaluate({
      documents: binaJayaDocs({ insuranceName: 'Bina Jaya Engineering Sdn Bhd', grade: 'G5', insuranceExpiry: '2026-12-05' }),
      now: NOW,
      contractValue: 8_000_000,
    });
    expect(result.findings.map((f) => f.rule).sort()).toEqual(
      [RuleCode.CIDB_GRADE_BELOW_CONTRACT_VALUE, RuleCode.COMPANY_NAME_MISMATCH, RuleCode.DOCUMENT_EXPIRING_SOON].sort(),
    );
    expect(result.score).toBe(45);
    expect(result.band).toBe('red');
    expect(result.deductions[0].severity).toBe(Severity.CRITICAL);
  });

  it('is deterministic', () => {
    const ctx = { documents: binaJayaDocs({ insuranceName: 'X Sdn Bhd' }), now: NOW, contractValue: 1 };
    expect(evaluate(ctx)).toEqual(evaluate(ctx));
  });
});
