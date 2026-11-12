import { BlobStorageAdapter } from './adapters/blob.adapter';
import { LocalStorageAdapter } from './adapters/local.adapter';
import { S3StorageAdapter } from './adapters/s3.adapter';
import type { StorageAdapter } from './adapters/storage.adapter';

export type StorageEnv = Partial<Record<string, string | undefined>>;

/**
 * Builds a storage adapter from environment variables. Framework-free so scripts (seed) can reuse it.
 */
export function createStorageAdapter(env: StorageEnv = process.env, warn: (msg: string) => void = console.warn): StorageAdapter {
  const driver = env.STORAGE_DRIVER ?? 'local';
  if (driver === 's3') {
    return new S3StorageAdapter(
      {
        endpoint: env.S3_ENDPOINT || undefined,
        region: env.S3_REGION ?? 'us-east-1',
        bucket: env.S3_BUCKET ?? 'vendor-passport',
        accessKey: env.S3_ACCESS_KEY || undefined,
        secretKey: env.S3_SECRET_KEY || undefined,
        forcePathStyle: env.S3_FORCE_PATH_STYLE === undefined ? true : ['1', 'true', 'yes'].includes(env.S3_FORCE_PATH_STYLE.toLowerCase()),
        sse: env.S3_SSE || undefined,
      },
      warn,
    );
  }
  const port = env.PORT ?? '4000';
  const links = {
    apiUrl: env.API_URL ?? `http://localhost:${port}`,
    apiPrefix: env.API_PREFIX ?? 'api/v1',
    secret: env.SHARE_TOKEN_SECRET ?? env.JWT_SECRET ?? 'dev-secret',
  };
  if (driver === 'blob') {
    return new BlobStorageAdapter({ ...links, token: env.BLOB_READ_WRITE_TOKEN || undefined });
  }
  return new LocalStorageAdapter({ ...links, dir: env.LOCAL_STORAGE_DIR ?? './uploads' });
}
