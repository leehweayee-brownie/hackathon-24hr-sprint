import { Module } from '@nestjs/common';
import { RemindersScheduler } from './reminders.scheduler';
import { RemindersService } from './reminders.service';

@Module({
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}

@Module({
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersWorkerModule {}
