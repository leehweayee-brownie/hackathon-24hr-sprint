import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigService } from './config/config.service';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const config = app.get(AppConfigService);
  new Logger('Worker').log(`Document worker started (AI provider: ${config.get('AI_PROVIDER')}, storage: ${config.get('STORAGE_DRIVER')})`);
}

void bootstrap();
