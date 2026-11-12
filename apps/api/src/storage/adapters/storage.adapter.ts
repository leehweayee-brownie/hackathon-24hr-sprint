export interface PutOptions {
  contentType: string;
  /** Original file name used for Content-Disposition on download. */
  fileName?: string;
}

export interface StorageAdapter {
  readonly kind: 's3' | 'local';
  put(key: string, body: Buffer, options: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Short-lived URL a browser can open directly. */
  signedUrl(key: string, ttlSeconds: number, fileName?: string): Promise<string>;
  healthCheck(): Promise<boolean>;
}

export function documentKey(supplierId: string, documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-() ]+/g, '_');
  return `suppliers/${supplierId}/documents/${documentId}/${safe}`;
}
