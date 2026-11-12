import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocType } from '@vp/shared';
import { resolveRelativeDate } from '../common/utils/dates';
import { ExtractionService, normalizeFields } from './extraction.service';
import { MockExtractionProvider } from './providers/mock.provider';
import { extractJson, extractionSchema } from './schemas';

describe('normalizeFields', () => {
  it('normalizes values by field kind and fills in missing keys', () => {
    const out = normalizeFields(DocType.PUBLIC_LIABILITY, [
      { key: 'insured_party', rawValue: 'Bina Jaya Engineering Sdn. Bhd.', confidence: 0.96, page: 1, bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.02 } },
      { key: 'coverage_amount', rawValue: 'RM 2,000,000.00', confidence: 0.9, page: 1, bbox: null },
      { key: 'expiry_date', rawValue: '05/12/2026', confidence: 1.4, page: 0, bbox: null },
      { key: 'not_a_field', rawValue: 'x', confidence: 1, page: 1, bbox: null },
      { key: 'insured_party', rawValue: 'duplicate', confidence: 1, page: 1, bbox: null },
    ]);
    const byKey = Object.fromEntries(out.map((f) => [f.key, f]));
    expect(byKey.insured_party.normalizedValue).toBe('BINA JAYA ENGINEERING SDN BHD');
    expect(byKey.insured_party.rawValue).toBe('Bina Jaya Engineering Sdn. Bhd.');
    expect(byKey.coverage_amount.normalizedValue).toBe('2000000');
    expect(byKey.expiry_date.normalizedValue).toBe('2026-12-05');
    expect(byKey.expiry_date.confidence).toBe(1);
    expect(byKey.expiry_date.page).toBe(1);
    expect(byKey.not_a_field).toBeUndefined();
    expect(byKey.policy_no.rawValue).toBeNull();
    expect(byKey.policy_no.confidence).toBe(0);
    expect(out.filter((f) => f.key === 'insured_party')).toHaveLength(1);
  });
});

describe('resolveRelativeDate', () => {
  const now = new Date('2026-11-12T15:00:00Z');
  it('resolves tokens relative to the UTC date', () => {
    expect(resolveRelativeDate('{{today}}', now)).toBe('2026-11-12');
    expect(resolveRelativeDate('{{today+23d}}', now)).toBe('2026-12-05');
    expect(resolveRelativeDate('{{today-60d}}', now)).toBe('2026-09-13');
    expect(resolveRelativeDate('{{today+23d:dd/MM/yyyy}}', now)).toBe('05/12/2026');
    expect(resolveRelativeDate('{{today+23d:d MMMM yyyy}}', now)).toBe('5 December 2026');
  });
  it('passes other values through', () => {
    expect(resolveRelativeDate('5 Dec 2026', now)).toBe('5 Dec 2026');
    expect(resolveRelativeDate(null, now)).toBeNull();
  });
});

describe('extractJson', () => {
  it('tolerates code fences and prose', () => {
    expect(extractJson('Sure:\n```json\n{"docType":"SSM","confidence":0.9}\n```')).toEqual({ docType: 'SSM', confidence: 0.9 });
    expect(extractJson('{"a":1} trailing')).toEqual({ a: 1 });
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('MockExtractionProvider', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vp-fixtures-'));
    await mkdir(join(dir, 'extractions'));
    await writeFile(
      join(dir, 'extractions', 'Policy.PDF.json'),
      JSON.stringify({
        fileName: 'Policy.PDF',
        classification: { docType: 'PUBLIC_LIABILITY', confidence: 0.95 },
        fields: [{ key: 'expiry_date', rawValue: '{{today+23d:dd/MM/yyyy}}', confidence: 0.9, page: 1, bbox: null }],
      }),
    );
  });

  it('replays recordings by file name, case-insensitively, resolving date tokens', async () => {
    const provider = new MockExtractionProvider(dir, () => new Date('2026-11-12T00:00:00Z'));
    const input = { fileName: 'policy.pdf', sha256: 'x', mimeType: 'application/pdf', pageCount: 1 };
    const c = await provider.classify(input);
    expect(c.docType).toBe(DocType.PUBLIC_LIABILITY);
    const e = await provider.extract(input, DocType.PUBLIC_LIABILITY);
    expect(e.fields[0].rawValue).toBe('05/12/2026');
  });

  it('classifies unknown files as OTHER', async () => {
    const provider = new MockExtractionProvider(dir);
    const input = { fileName: 'mystery.pdf', sha256: 'y', mimeType: 'application/pdf', pageCount: 1 };
    expect((await provider.classify(input)).docType).toBe(DocType.OTHER);
    expect((await provider.extract(input, DocType.OTHER)).fields[0]).toMatchObject({ key: 'title', rawValue: 'mystery' });
  });
});

describe('extractionSchema', () => {
  it('accepts lists and numbers as printed values', () => {
    const parsed = extractionSchema.parse({
      fields: [
        { key: 'categories', rawValue: ['B', 'CE'], confidence: 1, page: 1, bbox: null },
        { key: 'coverage_amount', rawValue: 2000000, confidence: 0.9, page: 1, bbox: null },
        { key: 'issuer', rawValue: null, confidence: 0.2, page: 1, bbox: null },
      ],
    });
    expect(parsed.fields.map((f) => f.rawValue)).toEqual(['B, CE', '2000000', null]);
  });
});

describe('ExtractionService cache', () => {
  function service(providerName: string, prior: unknown) {
    const findFirst = jest.fn(async () => prior);
    const prisma = { document: { findFirst } };
    const config = { get: (k: string) => (k === 'ODIN_MODEL' ? 'gemini-3.5-flash' : 'claude-sonnet-5-5') };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new ExtractionService({ name: providerName } as any, prisma as any, {} as any, config as any);
    return { svc, findFirst };
  }

  it('names the model in use', () => {
    expect(service('odin', null).svc.currentModel).toBe('odin/gemini-3.5-flash');
    expect(service('mock', null).svc.currentModel).toBe('mock');
    expect(service('anthropic', null).svc.currentModel).toBe('claude-sonnet-5-5');
  });

  it('only reuses results produced by the model in use', async () => {
    const { svc, findFirst } = service('odin', null);
    await expect(svc.findCached('doc-2', 'abc')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sha256: 'abc', extractedBy: 'odin/gemini-3.5-flash' }) }));
  });
});
