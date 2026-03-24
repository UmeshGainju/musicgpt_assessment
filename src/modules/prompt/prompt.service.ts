import { Injectable, Inject } from '@nestjs/common';

import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  CursorPaginationParams,
  PaginatedResult,
} from '../../common/interfaces/pagination.interface';
import { PromptEntity } from './entities/prompt.entity';
import {
  IPromptRepository,
  PROMPT_REPOSITORY,
} from './interfaces/prompt-repository.interface';

const CACHE_TTL = 60;

@Injectable()
export class PromptService {
  constructor(
    @Inject(PROMPT_REPOSITORY)
    private readonly promptRepository: IPromptRepository,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, text: string): Promise<PromptEntity> {
    const prompt = await this.promptRepository.create(userId, text);
    await this.invalidateUserPromptCache(userId);
    return prompt;
  }

  async findByUserId(
    userId: string,
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<PromptEntity>> {
    const cacheKey = `cache:prompts:${userId}:${params.cursor || 'start'}:${params.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.promptRepository.findByUserId(userId, params);
    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  private async invalidateUserPromptCache(userId: string): Promise<void> {
    const keys = await this.redis.keys(`cache:prompts:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
