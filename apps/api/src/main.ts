import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', 1);
  app.setGlobalPrefix(config.get('API_PREFIX'));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: config.isProduction ? undefined : false }));
  app.enableCors({ origin: config.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false, transformOptions: { enableImplicitConversion: false } }));
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Vendor Passport API')
    .setDescription('AI-powered supplier onboarding: upload once, reuse everywhere.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), { jsonDocumentUrl: 'docs/json' });

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/${config.get('API_PREFIX')} (Swagger: http://localhost:${port}/docs)`);
}

void bootstrap();
