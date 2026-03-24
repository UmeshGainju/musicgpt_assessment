import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const PROMPT_QUEUE = 'prompt-processing';

@Injectable()
export class PromptProducer {
  private readonly logger = new Logger(PromptProducer.name);

  constructor(
    @InjectQueue(PROMPT_QUEUE)
    private readonly queue: Queue,
  ) {}

  async enqueue(
    promptId: string,
    userId: string,
    subscriptionStatus: string,
  ): Promise<void> {
    // PAID users get priority 1 (higher), FREE get priority 10 (lower)
    // In BullMQ, lower number = higher priority
    const priority = subscriptionStatus === 'PAID' ? 1 : 10;

    await this.queue.add(
      'process-prompt',
      { promptId, userId, subscriptionStatus },
      {
        priority,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(
      `Enqueued prompt ${promptId} for user ${userId} with priority ${priority} (${subscriptionStatus})`,
    );
  }
}
