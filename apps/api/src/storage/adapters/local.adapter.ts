import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { FileLinkSigner, type FileLinkOptions, type FileLinkToken } from './file-link';
import type { PutOptions, StorageAdapter } from './storage.adapter';

export interface LocalAdapterOptions extends FileLinkOptions {
  dir: string;
}

/** Local disk storage for development. Files are served through short-lived HMAC-signed links. */
export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'local' as const;
  private readonly root: string;
  private readonly links: FileLinkSigner;

  constructor(options: LocalAdapterOptions) {
    this.root = resolve(options.dir);
    this.links = new FileLinkSigner(options);
  }

  private pathFor(key: string): string {
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root)) throw new Error('Invalid storage key');
    return p;
  }

  async put(key: string, body: Buffer, _options: PutOptions): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async signedUrl(key: string, ttlSeconds: number, fileName?: string): Promise<string> {
    return this.links.url(key, ttlSeconds, fileName);
  }

  async healthCheck(): Promise<boolean> {
    await mkdir(this.root, { recursive: true });
    return true;
  }

  sign(payload: FileLinkToken): string {
    return this.links.sign(payload);
  }

  verifyLink(token: string): FileLinkToken | null {
    return this.links.verify(token);
  }
}
