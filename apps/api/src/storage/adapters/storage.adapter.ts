import type { Readable } from 'node:stream';
import type { FileLinkToken } from './file-link';

export interface PutOptions {
  contentType: string;
  /** Original file name used for Content-Disposition on download. */
  fileName?: string;
}


export interface FileStream {
  stream: Readable;
  contentType?: string;
  size?: number;
}

export type StorageKind = 's3' | 'local' | 'blob';

export interface StorageAdapter {
  readonly kind: StorageKind;
  put(key: string, body: Buffer, options: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Short-lived URL a browser can open directly. */
  signedUrl(key: string, ttlSeconds: number, fileName?: string): Promise<string>;
  healthCheck(): Promise<boolean>;
  /** Drivers served through the API's signed `/files/:token` route (local, blob) validate those tokens. */
  verifyLink?(token: string): FileLinkToken | null;
  /** Streaming read, so large files never sit in memory or hit response size limits. */
  getStream?(key: string): Promise<FileStream>;
}

export function documentKey(supplierId: string, documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-() ]+/g, '_');
  return `suppliers/${supplierId}/documents/${documentId}/${safe}`;
}
