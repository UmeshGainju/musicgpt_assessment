import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import {
  CursorPaginationParams,
  PaginatedResult,
} from '../../common/interfaces/pagination.interface';
import { PromptStatus } from '@prisma/client';
import { IPromptRepository } from './interfaces/prompt-repository.interface';
import { PromptEntity } from './entities/prompt.entity';

@Injectable()
export class PromptRepository implements IPromptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, text: string): Promise<PromptEntity> {
    const prompt = await this.prisma.prompt.create({
      data: {
        user_id: userId,
        text,
        status: PromptStatus.PENDING,
      },
    });
    return this.toEntity(prompt);
  }

  async findByUserId(
    userId: string,
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<PromptEntity>> {
    const { cursor, limit } = params;

    const prompts = await this.prisma.prompt.findMany({
      where: { user_id: userId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
    });

    const hasMore = prompts.length > limit;
    const data = hasMore ? prompts.slice(0, limit) : prompts;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data: data.map(this.toEntity),
      meta: { next_cursor: nextCursor },
    };
  }

  async findById(id: string): Promise<PromptEntity | null> {
    const prompt = await this.prisma.prompt.findUnique({ where: { id } });
    return prompt ? this.toEntity(prompt) : null;
  }

  async findPending(batchSize: number): Promise<PromptEntity[]> {
    const prompts = await this.prisma.prompt.findMany({
      where: { status: PromptStatus.PENDING },
      take: batchSize,
      orderBy: { created_at: 'asc' },
      include: { user: { select: { subscription_status: true } } },
    });
    return prompts.map((p) => ({
      ...this.toEntity(p),
      subscription_status: p.user.subscription_status,
    }));
  }

  async updateStatus(id: string, status: string): Promise<PromptEntity> {
    const prompt = await this.prisma.prompt.update({
      where: { id },
      data: { status: status as PromptStatus },
    });
    return this.toEntity(prompt);
  }

  private toEntity(prompt: {
    id: string;
    user_id: string;
    text: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  }): PromptEntity {
    return {
      id: prompt.id,
      user_id: prompt.user_id,
      text: prompt.text,
      status: prompt.status,
      created_at: prompt.created_at,
      updated_at: prompt.updated_at,
    };
  }
}
