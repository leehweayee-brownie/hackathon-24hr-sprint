import { Provider } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';
import { AppConfigService } from '../config/config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

function createRedis(config: AppConfigService): Redis {
  return new IORedis(config.get('REDIS_URL'), { maxRetriesPerRequest: null, lazyConnect: false, enableReadyCheck: true });
}

export const redisProviders: Provider[] = [
  { provide: REDIS_CLIENT, inject: [AppConfigService], useFactory: createRedis },
  { provide: REDIS_SUBSCRIBER, inject: [AppConfigService], useFactory: createRedis },
];
