import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { REDIS_CLIENT, withTimeout } from '../database/redis.provider';
import { StorageService } from '../storage/storage.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, redis, storage] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down'),
      withTimeout(this.redis.ping(), 2_000, 'Redis ping').then(() => 'up').catch(() => 'down'),
      this.storage.healthCheck().then((ok) => (ok ? 'up' : 'down')).catch(() => 'down'),
    ]);
    const status = db === 'up' && redis === 'up' && storage === 'up' ? 'ok' : 'degraded';
    return { status, db, redis, storage, storageKind: this.storage.kind, aiProvider: this.config.get('AI_PROVIDER'), time: new Date().toISOString() };
  }
}
