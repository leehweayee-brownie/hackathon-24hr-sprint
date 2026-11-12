import type { ClassificationResult, DocType, ExtractionResult } from '@vp/shared';

/** Prepared pages: a PDF (sent whole) or JPEG page images. */
export interface DocumentInput {
  fileName: string;
  sha256: string;
  mimeType: string;
  pageCount: number;
  pdf?: Buffer;
  images?: Buffer[];
}

export interface ExtractionProvider {
  readonly name: string;
  classify(input: DocumentInput): Promise<ClassificationResult>;
  extract(input: DocumentInput, docType: DocType): Promise<ExtractionResult>;
  /**
   * Free-form JSON task (e.g. turning a tender brief into requirements), optionally with a document attached.
   * Providers that cannot do this (the offline mock) leave it out and callers fall back to deterministic code.
   */
  completeJson?(instruction: string, input?: DocumentInput): Promise<unknown>;
}

export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');
