import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CursorPaginationParams,
  PaginatedResult,
} from '../../common/interfaces/pagination.interface';
import { IUserRepository } from './interfaces/user-repository.interface';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<UserEntity>> {
    const { cursor, limit } = params;

    const users = await this.prisma.user.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
      select: {
        id: true,
        email: true,
        display_name: true,
        subscription_status: true,
        created_at: true,
        updated_at: true,
      },
    });

    const hasMore = users.length > limit;
    const data = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data: data.map(this.toEntity),
      meta: { next_cursor: nextCursor },
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        display_name: true,
        subscription_status: true,
        created_at: true,
        updated_at: true,
      },
    });
    return user ? this.toEntity(user) : null;
  }

  async update(
    id: string,
    data: Partial<Pick<UserEntity, 'display_name'>>,
  ): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        display_name: true,
        subscription_status: true,
        created_at: true,
        updated_at: true,
      },
    });
    return this.toEntity(user);
  }

  private toEntity(user: {
    id: string;
    email: string;
    display_name: string;
    subscription_status: string;
    created_at: Date;
    updated_at: Date;
  }): UserEntity {
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      subscription_status: user.subscription_status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
