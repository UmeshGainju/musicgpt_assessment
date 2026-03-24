import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IAudioRepository,
  AUDIO_REPOSITORY,
} from './interfaces/audio-repository.interface';
import { AudioEntity } from './entities/audio.entity';
import { RedisService } from 'src/infrastructure/redis/redis.service';
import {
  CursorPaginationParams,
  PaginatedResult,
} from 'src/common/interfaces/pagination.interface';

const CACHE_TTL = 60;

@Injectable()
export class AudioService {
  constructor(
    @Inject(AUDIO_REPOSITORY)
    private readonly audioRepository: IAudioRepository,
    private readonly redis: RedisService,
  ) {}

  async findAll(
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<AudioEntity>> {
    const cacheKey = `cache:audio:list:${params.cursor || 'start'}:${params.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.audioRepository.findAll(params);
    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async findById(id: string): Promise<AudioEntity> {
    const cacheKey = `cache:audio:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const audio = await this.audioRepository.findById(id);
    if (!audio) {
      throw new NotFoundException('Audio not found');
    }

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(audio));
    return audio;
  }

  async update(
    id: string,
    data: Partial<Pick<AudioEntity, 'title'>>,
  ): Promise<AudioEntity> {
    const existing = await this.audioRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Audio not found');
    }

    const updated = await this.audioRepository.update(id, data);

    await this.redis.del(`cache:audio:${id}`);
    await this.invalidateListCache();

    return updated;
  }

  async invalidateListCache(): Promise<void> {
    const keys = await this.redis.keys('cache:audio:list:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
