import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { store_staff_status } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../../common/database/prisma.service';
import { STAFF_ALLOWED_KEY } from '../decorators/staff-allowed.decorator';
import { TokenService } from '../services/token.service';
import { StoreAccessTokenPayload } from '../types/store-token-payload.type';

export type AuthenticatedStore = StoreAccessTokenPayload;

export type AuthenticatedStoreRequest = Request & {
  store?: AuthenticatedStore;
  storeId?: string;
};

@Injectable()
export class StoreAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedStoreRequest>();
    const token = this.extractBearerToken(request);
    const payload = this.tokenService.verifyAccessToken(token);

    if (payload.role === 'staff') {
      this.assertStaffAllowed(context);
      await this.assertStaffActive(payload);
    }

    request.store = payload;
    request.storeId = payload.storeId;

    return true;
  }

  // 직원은 @StaffAllowed()가 붙은 API만 쓸 수 있다(기본 거부).
  private assertStaffAllowed(context: ExecutionContext): void {
    const allowed = this.reflector.getAllAndOverride<boolean>(
      STAFF_ALLOWED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowed) {
      throw new ForbiddenException({
        code: 'OWNER_ONLY',
        message: '점주만 사용할 수 있는 기능입니다.',
      });
    }
  }

  // 해제된 직원·탈퇴한 매장은 access 토큰이 남아 있어도 즉시 막는다.
  // 점주 요청에는 DB 조회를 하지 않는다.
  private async assertStaffActive(
    payload: StoreAccessTokenPayload,
  ): Promise<void> {
    const staff = await this.prisma.store_staff.findFirst({
      where: {
        id: payload.staffId,
        store_id: payload.storeId,
        status: store_staff_status.active,
        stores: { closed_at: null },
      },
      select: { id: true },
    });

    if (!staff) {
      throw new UnauthorizedException({
        code: 'STAFF_REVOKED',
        message:
          '직원 권한이 해제되었습니다. 점주에게 새 초대코드를 받아주세요.',
      });
    }
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
