import {
  CursorPaginationParams,
  PaginatedResult,
} from 'src/common/interfaces/pagination.interface';
import { AudioEntity } from '../entities/audio.entity';

export const AUDIO_REPOSITORY = 'AUDIO_REPOSITORY';

export interface IAudioRepository {
  findAll(
    params: CursorPaginationParams,
  ): Promise<PaginatedResult<AudioEntity>>;
  findById(id: string): Promise<AudioEntity | null>;
  update(
    id: string,
    data: Partial<Pick<AudioEntity, 'title'>>,
  ): Promise<AudioEntity>;
  create(data: {
    prompt_id: string;
    user_id: string;
    title: string;
    url: string;
  }): Promise<AudioEntity>;
}
