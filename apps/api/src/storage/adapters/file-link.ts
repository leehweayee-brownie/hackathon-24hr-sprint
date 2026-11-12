import { createHmac, timingSafeEqual } from 'node:crypto';

export interface FileLinkOptions {
  /** Base URL of the API, used to build download links. */
  apiUrl: string;
  apiPrefix: string;
  secret: string;
}

export interface FileLinkToken {
  key: string;
  exp: number;
  name?: string;
}

/**
 * Short-lived HMAC-signed download links served by the API (`GET /<prefix>/files/:token`).
 * Used by storage drivers whose files are not directly reachable by the browser (local disk, private Vercel Blob).
 */
export class FileLinkSigner {
  constructor(private readonly options: FileLinkOptions) {}

  url(key: string, ttlSeconds: number, fileName?: string): string {
    const token = this.sign({ key, exp: Date.now() + ttlSeconds * 1000, name: fileName });
    return `${this.options.apiUrl.replace(/\/$/, '')}/${this.options.apiPrefix}/files/${token}`;
  }

  sign(payload: FileLinkToken): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.options.secret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  /** Returns the payload when the token is valid and unexpired, else null. */
  verify(token: string): FileLinkToken | null {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = createHmac('sha256', this.options.secret).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as FileLinkToken;
      if (!payload.key || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
