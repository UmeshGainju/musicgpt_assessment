import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  CursorPaginationParams,
  PaginatedResult,
} from '../../common/interfaces/pagination.interface';
import {
  IUserRepository,
  USER_REPOSITORY,
} from './interfaces/user-repository.interface';
import { UserEntity } from './entities/user.entity';

const CACHE_TTL = 60; // seconds

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly redis: RedisService,
  ) {}

  async findAll(
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<UserEntity>> {
    const cacheKey = `cache:users:list:${params.cursor || 'start'}:${params.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.userRepository.findAll(params);
    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async findById(id: string): Promise<UserEntity> {
    const cacheKey = `cache:user:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(user));
    return user;
  }

  async update(
    id: string,
    data: Partial<Pick<UserEntity, 'display_name'>>,
  ): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.userRepository.update(id, data);

    // Invalidate cache
    await this.redis.del(`cache:user:${id}`);
    await this.invalidateListCache();

    return updated;
  }

  private async invalidateListCache(): Promise<void> {
    const keys = await this.redis.keys('cache:users:list:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
