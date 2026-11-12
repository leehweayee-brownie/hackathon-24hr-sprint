import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { LocalStorageAdapter } from './adapters/local.adapter';
import type { PutOptions, StorageAdapter } from './adapters/storage.adapter';
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
      },
      (msg) => this.logger.warn(msg),
    );
  }

  get kind(): 's3' | 'local' {
    return this.adapter.kind;
  }

  put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    return this.adapter.put(key, body, options);
  }

  get(key: string): Promise<Buffer> {
    return this.adapter.get(key);
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

  /** Only meaningful for the local driver: validates a signed file token. */
  verifyLocalToken(token: string): { key: string; name?: string } | null {
    if (!(this.adapter instanceof LocalStorageAdapter)) return null;
    return this.adapter.verify(token);
  }
}
