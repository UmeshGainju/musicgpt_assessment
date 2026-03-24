import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  message: string;
  data?: T;
  meta?: { next_cursor: string | null };
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((body) => {
        if (body === null || body === undefined) {
          return { success: true as const, message: 'Success' };
        }

        if (
          typeof body === 'object' &&
          !Array.isArray(body) &&
          'message' in body
        ) {
          const { message, data, meta, ...rest } = body;

          // { message, data, meta } — paginated
          if (data !== undefined && meta !== undefined) {
            return { success: true as const, message, data, meta };
          }

          // { message, data } — standard data response
          if (data !== undefined) {
            return { success: true as const, message, data };
          }

          // { message } only (+ no other keys) — message-only response
          if (Object.keys(rest).length === 0) {
            return { success: true as const, message };
          }
        }

        // Fallback: wrap entire body as data
        return { success: true as const, message: 'Success', data: body };
      }),
    );
  }
}
