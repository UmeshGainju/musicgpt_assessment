import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: { field: string; error: string[] }[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          status = HttpStatus.PRECONDITION_FAILED;
          details = this.groupValidationErrors(resp.message as string[]);
        } else {
          message =
            (resp.message as string) || (resp.error as string) || 'Error';
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const errorResponse: Record<string, unknown> = {
      success: false,
      message,
    };

    if (details) {
      errorResponse.details = details;
    }

    response.status(status).json(errorResponse);
  }

  private groupValidationErrors(
    messages: string[],
  ): { field: string; error: string[] }[] {
    const grouped = new Map<string, string[]>();

    for (const msg of messages) {
      // class-validator messages typically start with the property name
      const field = msg.split(' ')[0] || 'unknown';
      const existing = grouped.get(field);
      if (existing) {
        existing.push(msg);
      } else {
        grouped.set(field, [msg]);
      }
    }

    return Array.from(grouped, ([field, error]) => ({ field, error }));
  }
}
