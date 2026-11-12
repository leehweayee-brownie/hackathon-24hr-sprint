import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { DocumentsModule } from '../documents/documents.module';
import { RemindersModule } from '../reminders/reminders.module';
import { FieldsController } from './fields.controller';
import { FieldsService } from './fields.service';

@Module({
  imports: [DocumentsModule, CrossCheckModule, RemindersModule],
  providers: [FieldsService],
  controllers: [FieldsController],
})
export class FieldsModule {}
