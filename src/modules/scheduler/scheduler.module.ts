import { Module } from '@nestjs/common';
import { PromptScheduler } from './prompt.scheduler';
import { PromptModule } from '../prompt/prompt.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PromptModule, QueueModule],
  providers: [PromptScheduler],
})
export class SchedulerModule {}
