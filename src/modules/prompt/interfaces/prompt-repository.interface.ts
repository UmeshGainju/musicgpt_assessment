import { PromptEntity } from '../entities/prompt.entity';
import {
  CursorPaginationParams,
  PaginatedResult,
} from 'src/common/interfaces/pagination.interface';

export const PROMPT_REPOSITORY = 'PROMPT_REPOSITORY';

export interface IPromptRepository {
  create(userId: string, text: string): Promise<PromptEntity>;
  findByUserId(
    userId: string,
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<PromptEntity>>;
  findById(id: string): Promise<PromptEntity | null>;
  findPending(batchSize: number): Promise<PromptEntity[]>;
  updateStatus(id: string, status: string): Promise<PromptEntity>;
}
