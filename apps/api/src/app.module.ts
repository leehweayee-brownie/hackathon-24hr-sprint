import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { CrossCheckModule } from './cross-check/cross-check.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { FieldsModule } from './fields/fields.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PassportsModule } from './passports/passports.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { VendorChecksModule } from './vendor-checks/vendor-checks.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({ throttlers: [{ ttl: config.get('RATE_LIMIT_TTL_SECONDS') * 1000, limit: config.get('RATE_LIMIT_MAX') }] }),
    }),
    AuditModule,
    NotificationsModule,
    UsersModule,
    OrganizationsModule,
    AuthModule,
    RealtimeModule,
    CrossCheckModule,
    DocumentsModule,
    FieldsModule,
    PassportsModule,
    VendorChecksModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
