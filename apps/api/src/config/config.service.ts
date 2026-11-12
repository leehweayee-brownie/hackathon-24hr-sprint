import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env';

/** Typed access to validated environment variables. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGIN')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get redisOptions(): { host: string; port: number; password?: string; username?: string; db?: number; tls?: object } {
    const url = new URL(this.get('REDIS_URL'));
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password ? decodeURIComponent(url.password) : undefined,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  }
}
