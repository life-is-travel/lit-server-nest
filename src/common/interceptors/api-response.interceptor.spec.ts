import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  const context = {} as ExecutionContext;

  it('wraps controller data with the common success response format', async () => {
    const interceptor = new ApiResponseInterceptor();
    const handler: CallHandler = {
      handle: () => of({ id: 'reservation_1' }),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(context, handler),
    )) as {
      success: true;
      data: { id: string };
      timestamp: string;
    };

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'reservation_1' });
    expect(typeof result.timestamp).toBe('string');
  });

  it('does not wrap an already formatted response again', async () => {
    const interceptor = new ApiResponseInterceptor();
    const response = {
      success: true,
      data: { status: 'ok' },
      timestamp: new Date().toISOString(),
    };
    const handler: CallHandler = {
      handle: () => of(response),
    };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toBe(response);
  });
});
