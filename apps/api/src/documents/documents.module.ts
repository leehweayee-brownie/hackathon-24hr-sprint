import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { RemindersModule } from '../reminders/reminders.module';
import { DocumentAccessService } from './document-access.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentPipelineRunner } from './pipeline/document-pipeline.runner';
import { DocumentPipelineService } from './pipeline/document-pipeline.service';

@Module({
  imports: [ExtractionModule, CrossCheckModule, RemindersModule],
  providers: [DocumentsService, DocumentAccessService, DocumentPipelineService, DocumentPipelineRunner],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentAccessService, DocumentPipelineRunner],
})
export class DocumentsModule {}
