import { Injectable } from '@nestjs/common';
import { IAudioRepository } from './interfaces/audio-repository.interface';
import { AudioEntity } from './entities/audio.entity';
import {
  CursorPaginationParams,
  PaginatedResult,
} from 'src/common/interfaces/pagination.interface';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class AudioRepository implements IAudioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<AudioEntity>> {
    const { cursor, limit } = params;

    const audios = await this.prisma.audio.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
    });

    const hasMore = audios.length > limit;
    const data = hasMore ? audios.slice(0, limit) : audios;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data: data.map(this.toEntity),
      meta: { next_cursor: nextCursor },
    };
  }

  async findById(id: string): Promise<AudioEntity | null> {
    const audio = await this.prisma.audio.findUnique({ where: { id } });
    return audio ? this.toEntity(audio) : null;
  }

  async update(
    id: string,
    data: Partial<Pick<AudioEntity, 'title'>>,
  ): Promise<AudioEntity> {
    const audio = await this.prisma.audio.update({
      where: { id },
      data,
    });
    return this.toEntity(audio);
  }

  async create(data: {
    prompt_id: string;
    user_id: string;
    title: string;
    url: string;
  }): Promise<AudioEntity> {
    const audio = await this.prisma.audio.create({ data });
    return this.toEntity(audio);
  }

  private toEntity(audio: {
    id: string;
    prompt_id: string;
    user_id: string;
    title: string;
    url: string;
    created_at: Date;
    updated_at: Date;
  }): AudioEntity {
    return {
      id: audio.id,
      prompt_id: audio.prompt_id,
      user_id: audio.user_id,
      title: audio.title,
      url: audio.url,
      created_at: audio.created_at,
      updated_at: audio.updated_at,
    };
  }
}
