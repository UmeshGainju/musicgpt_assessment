import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PROMPT_QUEUE, PromptProducer } from './prompt.producer';
import { PromptProcessor } from './prompt.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PROMPT_QUEUE,
    }),
  ],
  providers: [PromptProducer, PromptProcessor],
  exports: [PromptProducer],
})
export class QueueModule {}
