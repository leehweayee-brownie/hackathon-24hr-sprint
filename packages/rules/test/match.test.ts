import { DocType, type TenderRequirements } from '@vp/shared';
import { describe, expect, it } from 'vitest';
import { compareMatches, matchSupplier, minGradeForValue } from '../src';
import { NOW, binaJayaDocs } from './helpers';

const req = (over: Partial<TenderRequirements> = {}): TenderRequirements => ({
  title: 'Test tender',
  scope: 'Building works',
  contractValue: 3_000_000,
  location: null,
  startDate: null,
  endDate: null,
  minCidbGrade: null,
  minLiabilityCoverage: null,
  requiredDocTypes: [DocType.SSM, DocType.CIDB, DocType.PUBLIC_LIABILITY],
  notes: [],
  ...over,
});
const base = { rating: { average: null, count: 0 }, pastJobs: 0, now: NOW };

describe('vendor match', () => {
  it('derives the minimum CIDB grade from the contract value', () => {
    expect(minGradeForValue(7_000_000)).toBe('G6');
    expect(minGradeForValue(5_000_000)).toBe('G5');
    expect(minGradeForValue(50_000_000)).toBe('G7');
    expect(minGradeForValue(null)).toBeNull();
  });

  it('excludes a G5 supplier from a RM7M tender and says why', () => {
    const m = matchSupplier({ ...base, documents: binaJayaDocs(), requirements: req({ contractValue: 7_000_000 }) });
    expect(m.fit).toBe('excluded');
    expect(m.summary).toBe("G5 caps at RM5M, so they're excluded for this tender.");
    expect(m.gaps[0]).toMatchObject({ kind: 'grade_below', requestable: false });
  });

  it('qualifies a supplier whose verified documents meet everything', () => {
    const m = matchSupplier({ ...base, documents: binaJayaDocs(), requirements: req(), rating: { average: 4.6, count: 3 } });
    expect(m.fit).toBe('qualified');
    expect(m.gaps).toEqual([]);
    expect(m.summary).toContain('G5');
    expect(m.summary).toContain('rated 4.6 from 3 past jobs');
  });

  it('makes a supplier conditional when a document expires before the contract ends', () => {
    const m = matchSupplier({ ...base, documents: binaJayaDocs(), requirements: req({ endDate: '2027-12-31' }) });
    expect(m.fit).toBe('conditional');
    expect(m.gaps.map((g) => g.kind)).toContain('expires_before_end');
    expect(m.summary).toMatch(/^Qualifies if they renew their/);
  });

  it('asks for a missing required document', () => {
    const m = matchSupplier({ ...base, documents: binaJayaDocs(), requirements: req({ requiredDocTypes: [DocType.BANK_REFERENCE] }) });
    expect(m.fit).toBe('conditional');
    expect(m.gaps).toEqual([expect.objectContaining({ kind: 'missing_document', docType: DocType.BANK_REFERENCE, requestable: true })]);
    expect(m.summary).toBe('Qualifies if they submit a bank reference letter.');
  });

  it('flags cover below the buyer minimum', () => {
    const m = matchSupplier({ ...base, documents: binaJayaDocs(), requirements: req({ minLiabilityCoverage: 5_000_000 }) });
    expect(m.gaps.map((g) => g.kind)).toEqual(['cover_below_minimum']);
    expect(m.liabilityCover).toBe(2_000_000);
  });

  it('names acronym documents correctly and caps long fix lists', () => {
    const m = matchSupplier({ ...base, documents: [], requirements: req({ requiredDocTypes: [DocType.SSM, DocType.ISO, DocType.TAX_CLEARANCE] }) });
    expect(m.summary).toBe('Qualifies if they submit an SSM company registration, submit an ISO / quality certificate and 2 more.');
  });

  it('matches location on the state', () => {
    const docs = binaJayaDocs();
    docs[0].fields.registered_address = { value: 'No. 8, Jalan Reko, 43000 Kajang, Selangor', confidence: 0.95, confirmed: false };
    const m = matchSupplier({ ...base, documents: docs, requirements: req({ location: 'Shah Alam, Selangor' }) });
    expect(m.strengths).toContain('based in Selangor');
  });

  it('ranks qualified first, then by rating', () => {
    const row = (fit: 'qualified' | 'conditional' | 'excluded', average: number | null) => ({ fit, rating: { average, count: average ? 1 : 0 }, trustScore: 80, pastJobs: 0 });
    const sorted = [row('excluded', 5), row('conditional', 5), row('qualified', 3), row('qualified', 4.6)].sort(compareMatches);
    expect(sorted.map((r) => `${r.fit}:${r.rating.average}`)).toEqual(['qualified:4.6', 'qualified:3', 'conditional:5', 'excluded:5']);
  });
});
