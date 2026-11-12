import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import type { FileStream, PutOptions, StorageAdapter, StorageKind } from './adapters/storage.adapter';
import { createStorageAdapter } from './storage.factory';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly adapter: StorageAdapter;

  constructor(private readonly config: AppConfigService) {
    this.adapter = createStorageAdapter(
      {
        STORAGE_DRIVER: config.get('STORAGE_DRIVER'),
        S3_ENDPOINT: config.get('S3_ENDPOINT'),
        S3_REGION: config.get('S3_REGION'),
        S3_BUCKET: config.get('S3_BUCKET'),
        S3_ACCESS_KEY: config.get('S3_ACCESS_KEY'),
        S3_SECRET_KEY: config.get('S3_SECRET_KEY'),
        S3_FORCE_PATH_STYLE: String(config.get('S3_FORCE_PATH_STYLE')),
        S3_SSE: config.get('S3_SSE'),
        LOCAL_STORAGE_DIR: config.get('LOCAL_STORAGE_DIR'),
        API_URL: config.get('API_URL'),
        API_PREFIX: config.get('API_PREFIX'),
        PORT: String(config.get('PORT')),
        SHARE_TOKEN_SECRET: config.get('SHARE_TOKEN_SECRET'),
        JWT_SECRET: config.get('JWT_SECRET'),
        BLOB_READ_WRITE_TOKEN: config.get('BLOB_READ_WRITE_TOKEN'),
      },
      (msg) => this.logger.warn(msg),
    );
  }

  get kind(): StorageKind {
    return this.adapter.kind;
  }

  put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    return this.adapter.put(key, body, options);
  }

  get(key: string): Promise<Buffer> {
    return this.adapter.get(key);
  }

  /** Streams when the driver supports it, otherwise wraps the buffered read. */
  async getStream(key: string): Promise<FileStream> {
    if (this.adapter.getStream) return this.adapter.getStream(key);
    const { Readable } = await import('node:stream');
    const body = await this.adapter.get(key);
    return { stream: Readable.from(body), size: body.length };
  }

  delete(key: string): Promise<void> {
    return this.adapter.delete(key);
  }

  signedUrl(key: string, fileName?: string, ttlSeconds = this.config.get('SIGNED_URL_TTL_SECONDS')): Promise<string> {
    return this.adapter.signedUrl(key, ttlSeconds, fileName);
  }

  healthCheck(): Promise<boolean> {
    return this.adapter.healthCheck();
  }

  /** Validates a signed `/files/:token` link (local and blob drivers). Null for drivers with their own URLs (s3). */
  verifyFileToken(token: string): { key: string; name?: string } | null {
    return this.adapter.verifyLink ? this.adapter.verifyLink(token) : null;
  }
}
