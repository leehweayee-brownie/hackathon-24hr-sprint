import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { DocumentsModule } from '../documents/documents.module';
import { RemindersModule } from '../reminders/reminders.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [DocumentsModule, CrossCheckModule, RemindersModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
