import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';

/** Reminder records and sending. Due reminders are sent on demand through POST /admin/reminders/run. */
@Module({
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
