import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { AppConfigService } from '../config/config.service';
import { AiUsageService } from './ai-usage.service';
import { EXTRACTION_PROVIDER, ExtractionProvider } from './extraction-provider.interface';
import { ExtractionService } from './extraction.service';
import { PagePrepService } from './page-prep.service';
import { AnthropicExtractionProvider } from './providers/anthropic.provider';
import { MockExtractionProvider } from './providers/mock.provider';
import { OdinExtractionProvider } from './providers/odin.provider';

export function createExtractionProvider(config: AppConfigService): ExtractionProvider {
  if (config.get('AI_PROVIDER') === 'odin') {
    return new OdinExtractionProvider({
      baseUrl: config.get('ODIN_BASE_URL') as string,
      apiKey: config.get('ODIN_API_KEY') as string,
      model: config.get('ODIN_MODEL'),
      timeoutMs: config.get('ODIN_TIMEOUT_MS'),
      principalId: config.get('ODIN_PRINCIPAL_ID'),
    });
  }
  if (config.get('AI_PROVIDER') === 'anthropic') {
    return new AnthropicExtractionProvider(config.get('ANTHROPIC_API_KEY') as string, config.get('AI_MODEL'));
  }
  return new MockExtractionProvider(resolve(process.cwd(), config.get('FIXTURES_DIR')));
}

@Module({
  providers: [
    { provide: EXTRACTION_PROVIDER, inject: [AppConfigService], useFactory: createExtractionProvider },
    ExtractionService,
    PagePrepService,
    AiUsageService,
  ],
  exports: [ExtractionService, PagePrepService, AiUsageService, EXTRACTION_PROVIDER],
})
export class ExtractionModule {}
