import { DocType } from '@vp/shared';
import { parseBrief, parseMoney } from './brief-parser';

describe('parseBrief', () => {
  it('reads the example brief', () => {
    const { requirements: r, source } = parseBrief(
      'Building works for a 3-storey office in Shah Alam, Selangor. Contract value RM7M, Feb 2027 to Jan 2028. Public liability at least RM5M. ISO 9001 required, plus a bank reference letter.',
    );
    expect(source).toBe('parser');
    expect(r.scope).toBe('Building works');
    expect(r.contractValue).toBe(7_000_000);
    expect(r.minLiabilityCoverage).toBe(5_000_000);
    expect(r.minCidbGrade).toBe('G6');
    expect(r.location).toBe('Selangor');
    expect(r.startDate).toBe('2027-02-01');
    expect(r.endDate).toBe('2028-01-31');
    expect(r.requiredDocTypes).toEqual(expect.arrayContaining([DocType.CIDB, DocType.PUBLIC_LIABILITY, DocType.ISO, DocType.BANK_REFERENCE]));
    expect(r.notes).toContain('ISO 9001');
  });

  it('keeps an explicit grade and uses the default cover', () => {
    const { requirements: r, assumptions } = parseBrief('Drainage upgrade, RM 950,000, G4 contractors.', { minLiabilityCoverage: 1_000_000 });
    expect(r.minCidbGrade).toBe('G4');
    expect(r.contractValue).toBe(950_000);
    expect(r.minLiabilityCoverage).toBe(1_000_000);
    expect(assumptions[0]).toContain('organisation settings');
  });

  it('parses money units', () => {
    expect(parseMoney('7', 'M')).toBe(7_000_000);
    expect(parseMoney('750', 'k')).toBe(750_000);
    expect(parseMoney('1,250,000')).toBe(1_250_000);
    expect(parseMoney('2.5', 'million')).toBe(2_500_000);
  });
});
