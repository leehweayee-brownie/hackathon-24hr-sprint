import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfigService } from './config/config.service';

/** Prefix, security headers, CORS, validation and Swagger. Shared by the long-running server and the Vercel Function. */
export function configureApp(app: NestExpressApplication): AppConfigService {
  const config = app.get(AppConfigService);
  app.set('trust proxy', 1);
  app.setGlobalPrefix(config.get('API_PREFIX'));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: config.isProduction ? undefined : false }));
  app.enableCors({ origin: config.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false, transformOptions: { enableImplicitConversion: false } }));

  const swagger = new DocumentBuilder()
    .setTitle('Vendor Passport API')
    .setDescription('AI-powered supplier onboarding: upload once, reuse everywhere.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), { jsonDocumentUrl: 'docs/json' });
  return config;
}
