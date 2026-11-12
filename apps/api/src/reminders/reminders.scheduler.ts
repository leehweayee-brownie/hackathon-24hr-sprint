import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

/** Runs in the worker process only. */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly reminders: RemindersService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    try {
      await this.reminders.sendDue();
    } catch (err) {
      this.logger.error(`Reminder run failed: ${(err as Error).message}`);
    }
  }
}
