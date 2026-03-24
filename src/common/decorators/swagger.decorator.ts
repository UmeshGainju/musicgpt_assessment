import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPreconditionFailedResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export class SwaggerDecorator {
  static ApiOk<T>(example: T) {
    return applyDecorators(
      ApiOkResponse({
        description: 'Success',
        example,
      }),
    );
  }

  static ApiCreated<T>(example: T) {
    return applyDecorators(
      ApiCreatedResponse({
        description: 'Created',
        example,
      }),
    );
  }

  static ApiUnauthorized(message?: string) {
    return applyDecorators(
      ApiUnauthorizedResponse({
        description: 'Unauthorized',
        example: {
          success: false,
          message: message || 'Unauthorized',
        },
      }),
    );
  }

  static ApiNotFound(message?: string) {
    return applyDecorators(
      ApiNotFoundResponse({
        description: 'Not Found',
        example: {
          success: false,
          message: message || 'Resource not found',
        },
      }),
    );
  }

  static ApiConflict(message?: string) {
    return applyDecorators(
      ApiConflictResponse({
        description: 'Conflict',
        example: {
          success: false,
          message: message || 'Resource already exists',
        },
      }),
    );
  }

  static ApiPreconditionFailed<T>(example: T) {
    return applyDecorators(
      ApiPreconditionFailedResponse({
        description: 'Validation Failed',
        example,
      }),
    );
  }

  static ApiInternalServer() {
    return applyDecorators(
      ApiInternalServerErrorResponse({
        description: 'Internal Server Error',
        example: {
          success: false,
          message: 'Internal server error',
        },
      }),
    );
  }
}
