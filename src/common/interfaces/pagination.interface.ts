export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    next_cursor: string | null;
  };
}
