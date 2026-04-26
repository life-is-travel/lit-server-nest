import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
        details: {
          retryAfter: Math.ceil(throttlerLimitDetail.ttl / 1000),
          limit: throttlerLimitDetail.limit,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
