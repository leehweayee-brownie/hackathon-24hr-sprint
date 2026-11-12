import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { RemindersWorkerModule } from '../reminders/reminders.module';
import { DocumentProcessor } from './document.processor';
import { DOCUMENTS_QUEUE } from './documents.queue';

/** Worker-side module: consumes the documents queue. */
@Module({
  imports: [BullModule.registerQueue({ name: DOCUMENTS_QUEUE }), ExtractionModule, CrossCheckModule, RemindersWorkerModule],
  providers: [DocumentProcessor],
})
export class IntakeModule {}
