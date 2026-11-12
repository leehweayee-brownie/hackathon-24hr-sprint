import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { DOCUMENTS_QUEUE } from '../intake/documents.queue';
import { RemindersModule } from '../reminders/reminders.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BullModule.registerQueue({ name: DOCUMENTS_QUEUE }), CrossCheckModule, RemindersModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
