import { readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { ClassificationResult, DocType, ExtractionRecording, ExtractionResult } from '@vp/shared';
import { resolveRelativeDate } from '../../common/utils/dates';
import type { DocumentInput, ExtractionProvider } from '../extraction-provider.interface';

/**
 * Replays recorded model responses from fixtures/extractions/<file name>.json so the whole app runs offline.
 * Unknown files classify as OTHER.
 */
export class MockExtractionProvider implements ExtractionProvider {
  readonly name = 'mock';
  private index: Map<string, string> | null = null;

  constructor(
    private readonly fixturesDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async load(fileName: string): Promise<ExtractionRecording | null> {
    const dir = resolve(this.fixturesDir, 'extractions');
    if (!this.index) {
      this.index = new Map();
      try {
        for (const f of await readdir(dir)) {
          if (f.toLowerCase().endsWith('.json')) this.index.set(f.slice(0, -5).toLowerCase(), join(dir, f));
        }
      } catch {
        return null;
      }
    }
    const path = this.index.get(basename(fileName).toLowerCase());
    if (!path) return null;
    try {
      return JSON.parse(await readFile(path, 'utf8')) as ExtractionRecording;
    } catch {
      return null;
    }
  }

  /** Call when new recordings are added at run time. */
  reset(): void {
    this.index = null;
  }

  async classify(input: DocumentInput): Promise<ClassificationResult> {
    await delay(150);
    const rec = await this.load(input.fileName);
    if (!rec) return { docType: DocType.OTHER, confidence: 0.5, reason: 'No recording for this file', usage: { inputTokens: 0, outputTokens: 0 } };
    return { ...rec.classification, usage: rec.classification.usage ?? { inputTokens: 0, outputTokens: 0 } };
  }

  async extract(input: DocumentInput, docType: DocType): Promise<ExtractionResult> {
    await delay(250);
    const rec = await this.load(input.fileName);
    if (!rec || rec.classification.docType !== docType) {
      return {
        fields: [{ key: 'title', rawValue: input.fileName.replace(/\.[^.]+$/, ''), confidence: 0.5, page: 1, bbox: null }],
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
    const now = this.now();
    return {
      fields: rec.fields.map((f) => ({ ...f, rawValue: resolveRelativeDate(f.rawValue, now) })),
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
