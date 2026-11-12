import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { AppConfigService } from '../config/config.service';
import { AiUsageService } from './ai-usage.service';
import { EXTRACTION_PROVIDER, ExtractionProvider } from './extraction-provider.interface';
import { ExtractionService } from './extraction.service';
import { PagePrepService } from './page-prep.service';
import { AnthropicExtractionProvider } from './providers/anthropic.provider';
import { MockExtractionProvider } from './providers/mock.provider';

export function createExtractionProvider(config: AppConfigService): ExtractionProvider {
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
