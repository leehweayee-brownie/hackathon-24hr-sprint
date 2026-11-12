import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { DatabaseModule } from './database/database.module';
import { IntakeModule } from './intake/intake.module';
import { QUEUE_PREFIX } from './intake/documents.queue';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RealtimePublisherModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

/** Document processing worker: queue consumer + reminder cron. No HTTP server. */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({ connection: config.redisOptions, prefix: QUEUE_PREFIX }),
    }),
    AuditModule,
    NotificationsModule,
    UsersModule,
    OrganizationsModule,
    RealtimePublisherModule,
    IntakeModule,
  ],
})
export class WorkerModule {}
