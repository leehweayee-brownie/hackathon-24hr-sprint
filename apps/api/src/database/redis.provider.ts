import { Logger, Provider } from '@nestjs/common';
import IORedis, { Redis, RedisOptions } from 'ioredis';
import { AppConfigService } from '../config/config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

/**
 * Connection options for a Redis URL, tuned for serverless cold starts and managed Redis:
 * - `rediss://` sends the hostname as the TLS servername (SNI); endpoints that route by SNI close the connection without it.
 * - a longer connect timeout covers a slow first TLS handshake on a cold start;
 * - TCP keep-alive stops idle connections being silently dropped between invocations;
 * - reconnects back off up to 5 s instead of hammering the server.
 */
export function redisConnectionOptions(redisUrl: string): RedisOptions {
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    lazyConnect: false,
    enableReadyCheck: true,
    connectTimeout: 20_000,
    keepAlive: 30_000,
    retryStrategy: (times) => Math.min(times * 500, 5_000),
  };
  const url = new URL(redisUrl);
  if (url.protocol === 'rediss:') options.tls = { servername: url.hostname };
  return options;
}

/** Rejects when `promise` has not settled within `ms`. For calls that must not hang on Redis (health, live updates). */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function createRedis(config: AppConfigService, name: string): Redis {
  const url = config.get('REDIS_URL');
  const client = new IORedis(url, redisConnectionOptions(url));
  const logger = new Logger(`Redis:${name}`);
  // Without a listener ioredis logs every failure as an "Unhandled error event". Log once per outage instead.
  let failing = false;
  client.on('error', (err: Error & { code?: string }) => {
    if (!failing) logger.warn(`Connection problem (${err.code ?? err.message}); retrying in the background`);
    failing = true;
  });
  client.on('ready', () => {
    if (failing) logger.log('Reconnected');
    failing = false;
  });
  return client;
}

export const redisProviders: Provider[] = [
  { provide: REDIS_CLIENT, inject: [AppConfigService], useFactory: (c: AppConfigService) => createRedis(c, 'client') },
  { provide: REDIS_SUBSCRIBER, inject: [AppConfigService], useFactory: (c: AppConfigService) => createRedis(c, 'subscriber') },
];
