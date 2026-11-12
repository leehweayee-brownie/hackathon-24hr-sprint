import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/** Long-running server (local development, Docker, container hosts). Vercel uses src/serverless.ts instead. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = configureApp(app);
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/${config.get('API_PREFIX')} (Swagger: http://localhost:${port}/docs)`);
}

void bootstrap();
