import { Provider } from '@nestjs/common';
import IORedis, { Redis, RedisOptions } from 'ioredis';
import { AppConfigService } from '../config/config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

/**
 * Connection options for a Redis URL. For `rediss://` (TLS) the hostname is sent as the TLS servername (SNI):
 * ioredis does not do this by itself, and managed Redis endpoints that route by SNI close the connection without it.
 */
export function redisConnectionOptions(redisUrl: string): RedisOptions {
  const options: RedisOptions = { maxRetriesPerRequest: null, lazyConnect: false, enableReadyCheck: true };
  const url = new URL(redisUrl);
  if (url.protocol === 'rediss:') options.tls = { servername: url.hostname };
  return options;
}

function createRedis(config: AppConfigService): Redis {
  const url = config.get('REDIS_URL');
  return new IORedis(url, redisConnectionOptions(url));
}

export const redisProviders: Provider[] = [
  { provide: REDIS_CLIENT, inject: [AppConfigService], useFactory: createRedis },
  { provide: REDIS_SUBSCRIBER, inject: [AppConfigService], useFactory: createRedis },
];
