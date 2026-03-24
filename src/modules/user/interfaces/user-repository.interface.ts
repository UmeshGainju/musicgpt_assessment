import {
  CursorPaginationParams,
  PaginatedResult,
} from 'src/common/interfaces/pagination.interface';
import { UserEntity } from '../entities/user.entity';

export const USER_REPOSITORY = 'USER_REPOSITORY';

export interface IUserRepository {
  findAll(params: CursorPaginationParams): Promise<PaginatedResult<UserEntity>>;
  findById(id: string): Promise<UserEntity | null>;
  update(
    id: string,
    data: Partial<Pick<UserEntity, 'display_name'>>,
  ): Promise<UserEntity>;
}
