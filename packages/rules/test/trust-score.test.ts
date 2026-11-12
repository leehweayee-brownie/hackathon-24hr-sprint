import { RuleCode, Severity } from '@vp/shared';
import { describe, expect, it } from 'vitest';
import { computeTrustScore } from '../src';

const finding = (rule: RuleCode, severity: Severity, deduction: number) => ({ rule, severity, deduction, message: rule, documentIds: [] });

describe('computeTrustScore', () => {
  it('starts at 100 and subtracts every deduction', () => {
    const r = computeTrustScore([finding(RuleCode.DOCUMENT_EXPIRING_SOON, Severity.WARNING, 10), finding(RuleCode.COMPANY_NAME_MISMATCH, Severity.WARNING, 20)]);
    expect(r.score).toBe(70);
    expect(r.band).toBe('amber');
  });
  it('never goes below zero', () => {
    const r = computeTrustScore(Array(5).fill(finding(RuleCode.DOCUMENT_EXPIRED, Severity.CRITICAL, 30)));
    expect(r.score).toBe(0);
    expect(r.band).toBe('red');
  });
  it('lists deductions critical first', () => {
    const r = computeTrustScore([
      finding(RuleCode.UNCONFIRMED_LOW_CONFIDENCE_FIELD, Severity.INFO, 5),
      finding(RuleCode.DOCUMENT_EXPIRED, Severity.CRITICAL, 30),
      finding(RuleCode.COMPANY_NAME_MISMATCH, Severity.WARNING, 20),
    ]);
    expect(r.deductions.map((d) => d.severity)).toEqual([Severity.CRITICAL, Severity.WARNING, Severity.INFO]);
  });
  it('bands 80 as green and 60 as amber', () => {
    expect(computeTrustScore([finding(RuleCode.COMPANY_NAME_MISMATCH, Severity.WARNING, 20)]).band).toBe('green');
    expect(computeTrustScore([finding(RuleCode.COMPANY_NAME_MISMATCH, Severity.WARNING, 40)]).band).toBe('amber');
    expect(computeTrustScore([finding(RuleCode.COMPANY_NAME_MISMATCH, Severity.WARNING, 41)]).band).toBe('red');
  });
});
