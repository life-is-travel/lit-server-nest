import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../services/token.service';
import { StoreAccessTokenPayload } from '../types/store-token-payload.type';

export type AuthenticatedStoreRequest = Request & {
  store?: StoreAccessTokenPayload;
  storeId?: string;
};

@Injectable()
export class StoreAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedStoreRequest>();
    const token = this.extractBearerToken(request);
    const payload = this.tokenService.verifyAccessToken(token);

    request.store = payload;
    request.storeId = payload.storeId;

    return true;
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: '인증이 필요합니다.',
        details: { message: 'Authorization 헤더가 없습니다.' },
      });
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: '인증이 필요합니다.',
        details: {
          message: 'Authorization 헤더는 "Bearer {token}" 형식이어야 합니다.',
        },
      });
    }

    return token;
  }
}
