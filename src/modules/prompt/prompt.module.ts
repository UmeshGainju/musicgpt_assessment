import { Module } from '@nestjs/common';
import { PROMPT_REPOSITORY } from './interfaces/prompt-repository.interface';
import { PromptService } from './prompt.service';
import { PromptRepository } from './prompt.repository';
import { PromptController } from './prompt.controller';

@Module({
  controllers: [PromptController],
  providers: [
    PromptService,
    {
      provide: PROMPT_REPOSITORY,
      useClass: PromptRepository,
    },
  ],
  exports: [PromptService, PROMPT_REPOSITORY],
})
export class PromptModule {}
