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
}

export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');
