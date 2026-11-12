import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { PutOptions, StorageAdapter } from './storage.adapter';

export interface LocalAdapterOptions {
  dir: string;
  /** Base URL of the API, used to build signed download links. */
  apiUrl: string;
  apiPrefix: string;
  secret: string;
}

export interface LocalFileToken {
  key: string;
  exp: number;
  name?: string;
}

/** Local disk storage for development. Files are served through short-lived HMAC-signed links. */
export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'local' as const;
  private readonly root: string;

  constructor(private readonly options: LocalAdapterOptions) {
    this.root = resolve(options.dir);
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
    const token = this.sign({ key, exp: Date.now() + ttlSeconds * 1000, name: fileName });
    return `${this.options.apiUrl.replace(/\/$/, '')}/${this.options.apiPrefix}/files/${token}`;
  }

  async healthCheck(): Promise<boolean> {
    await mkdir(this.root, { recursive: true });
    return true;
  }

  sign(payload: LocalFileToken): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.options.secret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  /** Returns the payload when the token is valid and unexpired, else null. */
  verify(token: string): LocalFileToken | null {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = createHmac('sha256', this.options.secret).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as LocalFileToken;
      if (!payload.key || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
