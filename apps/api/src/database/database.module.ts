import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from './prisma.service';
import { REDIS_CLIENT, REDIS_SUBSCRIBER, redisProviders } from './redis.provider';

@Global()
@Module({
  providers: [PrismaService, ...redisProviders],
  exports: [PrismaService, REDIS_CLIENT, REDIS_SUBSCRIBER],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.redis.quit(), this.subscriber.quit()]);
  }
}
