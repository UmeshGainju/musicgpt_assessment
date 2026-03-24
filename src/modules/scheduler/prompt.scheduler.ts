import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PromptProducer } from '../queue/prompt.producer';
import {
  IPromptRepository,
  PROMPT_REPOSITORY,
} from '../prompt/interfaces/prompt-repository.interface';

const BATCH_SIZE = 50;

@Injectable()
export class PromptScheduler {
  private readonly logger = new Logger(PromptScheduler.name);
  private isRunning = false;

  constructor(
    @Inject(PROMPT_REPOSITORY)
    private readonly promptRepository: IPromptRepository,
    private readonly promptProducer: PromptProducer,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollPendingPrompts(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      const pending = await this.promptRepository.findPending(BATCH_SIZE);
      if (pending.length === 0) {
        return;
      }

      this.logger.log(`Found ${pending.length} pending prompts`);

      for (const prompt of pending) {
        await this.promptRepository.updateStatus(prompt.id, 'PROCESSING');
        await this.promptProducer.enqueue(
          prompt.id,
          prompt.user_id,
          (prompt as any).subscription_status || 'FREE',
        );
      }

      this.logger.log(`Enqueued ${pending.length} prompts for processing`);
    } catch (error) {
      this.logger.error(
        `Scheduler error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
