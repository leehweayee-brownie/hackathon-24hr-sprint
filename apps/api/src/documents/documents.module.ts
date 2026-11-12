import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { DOCUMENTS_QUEUE } from '../intake/documents.queue';
import { DocumentAccessService } from './document-access.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [BullModule.registerQueue({ name: DOCUMENTS_QUEUE }), CrossCheckModule],
  providers: [DocumentsService, DocumentAccessService],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentAccessService],
})
export class DocumentsModule {}
