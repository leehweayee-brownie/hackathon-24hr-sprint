import { describe, expect, it } from 'vitest';
import { CIDB_GRADE_LIMITS, cidbGradeLimit, gradeAllowsContract } from '../src';

describe('CIDB grade limits', () => {
  it('has all seven grades in ascending order', () => {
    const limits = Object.values(CIDB_GRADE_LIMITS).map((g) => g.maxContractValue ?? Infinity);
    for (let i = 1; i < limits.length; i += 1) expect(limits[i]).toBeGreaterThan(limits[i - 1]);
  });
  it('allows contracts within the grade', () => {
    expect(gradeAllowsContract('G5', 5_000_000)).toBe(true);
    expect(gradeAllowsContract('G5', 5_000_001)).toBe(false);
    expect(gradeAllowsContract('G7', 1_000_000_000)).toBe(true);
    expect(gradeAllowsContract('G1', 200_000)).toBe(true);
  });
  it('treats unknown grades as not allowed', () => {
    expect(gradeAllowsContract(null, 1)).toBe(false);
    expect(gradeAllowsContract('G9', 1)).toBe(false);
    expect(cidbGradeLimit('G9')).toBeUndefined();
    expect(cidbGradeLimit('G7')).toBeNull();
  });
});
