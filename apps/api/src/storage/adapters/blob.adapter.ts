import { del, get, list, put } from '@vercel/blob';
import { Readable } from 'node:stream';
import { FileLinkSigner, type FileLinkOptions, type FileLinkToken } from './file-link';
import type { FileStream, PutOptions, StorageAdapter } from './storage.adapter';

export interface BlobAdapterOptions extends FileLinkOptions {
  /** BLOB_READ_WRITE_TOKEN. Optional on Vercel, where a connected store authenticates with OIDC (BLOB_STORE_ID). */
  token?: string;
}

/**
 * Vercel Blob, private store. Files are never public: the browser gets a short-lived signed API link
 * (`/files/:token`), and the API streams the file from Blob after checking the signature.
 * Streaming keeps downloads clear of the 4.5 MB function response limit.
 */
export class BlobStorageAdapter implements StorageAdapter {
  readonly kind = 'blob' as const;
  private readonly links: FileLinkSigner;

  constructor(private readonly options: BlobAdapterOptions) {
    this.links = new FileLinkSigner(options);
  }

  private auth(): { token?: string } {
    return this.options.token ? { token: this.options.token } : {};
  }

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    await put(key, body, {
      access: 'private',
      contentType: options.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      ...this.auth(),
    });
  }

  async getStream(key: string): Promise<FileStream> {
    const result = await get(key, { access: 'private', ...this.auth() });
    if (!result || result.statusCode !== 200) throw new Error(`Blob not found: ${key}`);
    return {
      stream: Readable.fromWeb(result.stream as unknown as import('node:stream/web').ReadableStream<Uint8Array>),
      contentType: result.blob.contentType ?? undefined,
      size: result.blob.size ?? undefined,
    };
  }

  async get(key: string): Promise<Buffer> {
    const { stream } = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await del(key, this.auth());
  }

  async signedUrl(key: string, ttlSeconds: number, fileName?: string): Promise<string> {
    return this.links.url(key, ttlSeconds, fileName);
  }

  async healthCheck(): Promise<boolean> {
    await list({ limit: 1, ...this.auth() });
    return true;
  }

  verifyLink(token: string): FileLinkToken | null {
    return this.links.verify(token);
  }
}
