import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse } from '../responses/api-response.type';

type MaybeWrappedResponse = {
  success?: unknown;
  timestamp?: unknown;
};

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | T
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private isAlreadyWrapped(data: unknown): data is T {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const response = data as MaybeWrappedResponse;

    return (
      typeof response.success === 'boolean' &&
      typeof response.timestamp === 'string'
    );
  }
}
