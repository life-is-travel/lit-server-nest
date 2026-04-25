import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorBody, ApiErrorResponse } from '../responses/api-response.type';

type HttpExceptionResponse = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = this.getHttpStatus(exception);
    const error = this.getErrorBody(exception, status);

    if (status >= 500) {
      this.logger.error(error.message, exception);
    }

    const body: ApiErrorResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorBody(exception: unknown, status: number): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        code: this.getDefaultErrorCode(status),
        message: '서버 오류가 발생했습니다.',
      };
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        code: this.getDefaultErrorCode(status),
        message: exceptionResponse,
      };
    }

    const errorResponse = exceptionResponse as HttpExceptionResponse;

    return {
      code: this.getStringOrDefault(
        errorResponse.code,
        this.getDefaultErrorCode(status),
      ),
      message: this.getMessage(errorResponse.message, exception.message),
      ...(errorResponse.details ? { details: errorResponse.details } : {}),
    };
  }

  private getMessage(message: unknown, fallback: string): string {
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return fallback;
  }

  private getStringOrDefault(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  private getDefaultErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
    };

    return errorCodes[status] ?? 'HTTP_ERROR';
  }
}
