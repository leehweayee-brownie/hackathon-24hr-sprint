import { describe, expect, it } from 'vitest';
import {
  normalizeCompanyName,
  normalizeGrade,
  parseAmount,
  parseDate,
  registrationNoTokens,
  registrationNosMatch,
} from '../src';

describe('normalizeCompanyName', () => {
  it('ignores case, punctuation and Sdn. Bhd. spelling', () => {
    expect(normalizeCompanyName('Bina Jaya Sdn. Bhd.')).toBe('BINA JAYA SDN BHD');
    expect(normalizeCompanyName('BINA JAYA SENDIRIAN BERHAD')).toBe('BINA JAYA SDN BHD');
    expect(normalizeCompanyName('bina  jaya sdn bhd')).toBe('BINA JAYA SDN BHD');
    expect(normalizeCompanyName('Bina-Jaya Sdn Bhd')).toBe('BINA JAYA SDN BHD');
  });

  it('keeps real differences', () => {
    expect(normalizeCompanyName('Bina Jaya Engineering Sdn Bhd')).not.toBe(normalizeCompanyName('Bina Jaya Sdn Bhd'));
  });

  it('handles empty input', () => {
    expect(normalizeCompanyName(null)).toBe('');
    expect(normalizeCompanyName('')).toBe('');
  });
});

describe('registration numbers', () => {
  it('extracts tokens from combined old/new numbers', () => {
    expect(registrationNoTokens('201501023456 (1156789-K)')).toEqual(['201501023456', '1156789K']);
  });
  it('matches when any token is shared', () => {
    expect(registrationNosMatch('1156789-K', '201501023456 (1156789-K)')).toBe(true);
    expect(registrationNosMatch('201501023456', '2015 0102 3456')).toBe(true);
    expect(registrationNosMatch('201501023457', '201501023456 (1156789-K)')).toBe(false);
    expect(registrationNosMatch('', '201501023456')).toBe(false);
  });
});

describe('parseDate', () => {
  it('parses the formats found on Malaysian documents', () => {
    expect(parseDate('2026-12-05')).toBe('2026-12-05');
    expect(parseDate('05/12/2026')).toBe('2026-12-05');
    expect(parseDate('05-12-2026')).toBe('2026-12-05');
    expect(parseDate('05.12.2026')).toBe('2026-12-05');
    expect(parseDate('5 December 2026')).toBe('2026-12-05');
    expect(parseDate('5 Dis 2026')).toBe('2026-12-05');
    expect(parseDate('12 Mac 2026')).toBe('2026-03-12');
    expect(parseDate('December 5, 2026')).toBe('2026-12-05');
    expect(parseDate('5th Dec 2026')).toBe('2026-12-05');
    expect(parseDate('2026-12-05T10:00:00.000Z')).toBe('2026-12-05');
  });
  it('rejects garbage', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('parseAmount', () => {
  it('parses ringgit amounts', () => {
    expect(parseAmount('RM 1,000,000.00')).toBe(1_000_000);
    expect(parseAmount('RM1,000,000')).toBe(1_000_000);
    expect(parseAmount('MYR 1.5 million')).toBe(1_500_000);
    expect(parseAmount('2000000')).toBe(2_000_000);
    expect(parseAmount('Ringgit Malaysia Two Million (RM2,000,000.00)')).toBe(2_000_000);
  });
  it('returns null when there is no number', () => {
    expect(parseAmount('unlimited')).toBeNull();
  });
});

describe('normalizeGrade', () => {
  it('reads grades from various spellings', () => {
    expect(normalizeGrade('G7')).toBe('G7');
    expect(normalizeGrade('Gred G5')).toBe('G5');
    expect(normalizeGrade('g 3')).toBe('G3');
    expect(normalizeGrade('Grade: G-4')).toBe('G4');
    expect(normalizeGrade('G9')).toBeNull();
    expect(normalizeGrade(null)).toBeNull();
  });
});
