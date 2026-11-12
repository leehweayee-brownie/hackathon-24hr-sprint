import { DOC_TYPE_DEFINITIONS, DocType, type BBox, type ExtractedField, type ExtractionRecording } from '@vp/shared';
import { addUtcDays, dateToken, formatDate, utcToday } from '../relative-dates';

/** A date relative to the generation day: carries both the printed string and the recording token. */
export class RelDate {
  constructor(
    public readonly offsetDays: number,
    public readonly fmt: string = 'dd/MM/yyyy',
  ) {}
  get printed(): string {
    return formatDate(addUtcDays(utcToday(), this.offsetDays), this.fmt);
  }
  get token(): string {
    return dateToken(this.offsetDays, this.fmt);
  }
  with(fmt: string): RelDate {
    return new RelDate(this.offsetDays, fmt);
  }
}

export const rel = (days: number, fmt?: string) => new RelDate(days, fmt);

/** Fixed value: printed text equals the recorded raw value. */
export interface PrintedValue {
  printed: string;
  token: string;
}
export const fixed = (s: string): PrintedValue => ({ printed: s, token: s });

export type Value = RelDate | PrintedValue | string;
export const printed = (v: Value): string => (typeof v === 'string' ? v : v.printed);
export const recorded = (v: Value): string => (typeof v === 'string' ? v : v.token);

export interface FieldSpec {
  key: string;
  rawValue: string | null;
  confidence: number;
  page: number;
  bbox: BBox | null;
}

/** Accumulates the fields for one document and checks keys against the doc-type definition. */
export class RecordingBuilder {
  private fields: FieldSpec[] = [];
  constructor(
    public readonly fileName: string,
    public readonly docType: DocType,
    public readonly classificationConfidence: number,
    public readonly reason: string,
  ) {}

  add(key: string, value: Value | null, bbox: BBox | null, confidence: number, page = 1): void {
    const def = DOC_TYPE_DEFINITIONS[this.docType];
    if (!def.fields.some((f) => f.key === key)) {
      throw new Error(`${this.fileName}: field "${key}" is not defined for ${this.docType}`);
    }
    if (this.fields.some((f) => f.key === key)) {
      throw new Error(`${this.fileName}: field "${key}" recorded twice`);
    }
    this.fields.push({
      key,
      rawValue: value === null ? null : recorded(value),
      confidence: Math.round(confidence * 100) / 100,
      page,
      bbox: bbox ? roundBox(bbox) : null,
    });
  }

  /** Copies an already-recorded field under another key (e.g. insured_party → company_name). */
  alias(fromKey: string, toKey: string, confidence?: number): void {
    const src = this.fields.find((f) => f.key === fromKey);
    if (!src) throw new Error(`${this.fileName}: cannot alias missing field ${fromKey}`);
    this.add(toKey, src.rawValue, src.bbox, confidence ?? src.confidence, src.page);
  }

  build(): ExtractionRecording {
    const def = DOC_TYPE_DEFINITIONS[this.docType];
    const missing = def.fields.filter((f) => f.required && !this.fields.some((x) => x.key === f.key));
    if (missing.length) {
      throw new Error(`${this.fileName}: missing required fields ${missing.map((m) => m.key).join(', ')}`);
    }
    const fields: ExtractedField[] = this.fields.map((f) => ({ ...f }));
    return {
      fileName: this.fileName,
      classification: { docType: this.docType, confidence: this.classificationConfidence, reason: this.reason },
      fields,
    };
  }
}

export function roundBox(b: BBox): BBox {
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return { x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) };
}

/** Deterministic PRNG (mulberry32) so scans look the same on every run. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIXED_PDF_DATE = new Date('2026-01-01T00:00:00Z');
