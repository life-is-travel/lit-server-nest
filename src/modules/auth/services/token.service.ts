import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  StoreAccessTokenPayload,
  StoreRefreshTokenPayload,
} from '../types/store-token-payload.type';
import {
  CustomerAccessTokenPayload,
  CustomerRefreshTokenPayload,
} from '../types/customer-token-payload.type';
import {
  AdminAccessTokenPayload,
  AdminRefreshTokenPayload,
} from '../types/admin-token-payload.type';

@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  generateAccessToken(storeId: string, email: string): string {
    return this.jwtService.sign(
      { storeId, email, type: 'access' } satisfies StoreAccessTokenPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_ACCESS_TOKEN_SECRET',
        ),
        expiresIn: toSeconds(
          this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_EXPIRES_IN'),
        ),
      },
    );
  }

  generateRefreshToken(storeId: string, email: string): string {
    return this.jwtService.sign(
      { storeId, email, type: 'refresh' } satisfies StoreRefreshTokenPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_REFRESH_TOKEN_SECRET',
        ),
        expiresIn: this.getStoreRefreshTokenExpiresInSeconds(),
      },
    );
  }

  generateCustomerAccessToken(customerId: string, provider?: string): string {
    return this.jwtService.sign(
      {
        customerId,
        role: 'customer',
        provider,
        type: 'access',
      } satisfies CustomerAccessTokenPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_ACCESS_TOKEN_SECRET',
        ),
        expiresIn: toSeconds(
          this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_EXPIRES_IN'),
        ),
      },
    );
  }

  generateCustomerRefreshToken(customerId: string, provider?: string): string {
    return this.jwtService.sign(
      {
        customerId,
        role: 'customer',
        provider,
        type: 'refresh',
      } satisfies CustomerRefreshTokenPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_REFRESH_TOKEN_SECRET',
        ),
        expiresIn: toSeconds(
          this.configService.getOrThrow<string>('JWT_REFRESH_TOKEN_EXPIRES_IN'),
        ),
      },
    );
  }

  // 관리자 토큰은 점주·고객과 다른 시크릿(JWT_ADMIN_*)으로 서명한다.
  // 점주·고객 시크릿이 유출되어도 관리자 토큰을 위조할 수 없게 하기 위함이다.
  generateAdminAccessToken(adminId: string, email: string): string {
    return this.jwtService.sign(
      {
        adminId,
        email,
        role: 'admin',
        type: 'access',
      } satisfies AdminAccessTokenPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_ADMIN_ACCESS_TOKEN_SECRET',
        ),
        expiresIn: toSeconds(
          this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_EXPIRES_IN'),
        ),
      },
    );
  }

  generateAdminRefreshToken(adminId: string, email: string): string {
    return this.jwtService.sign(
      {
        adminId,
        email,
        role: 'admin',
        type: 'refresh',
      } satisfies AdminRefreshTokenPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_ADMIN_REFRESH_TOKEN_SECRET',
        ),
        expiresIn: toSeconds(
          this.configService.getOrThrow<string>('JWT_REFRESH_TOKEN_EXPIRES_IN'),
        ),
      },
    );
  }

  verifyAccessToken(token: string): StoreAccessTokenPayload {
    const payload = this.verify<StoreAccessTokenPayload>(
      token,
      'JWT_ACCESS_TOKEN_SECRET',
    );

    if (
      payload.type !== 'access' ||
      typeof payload.storeId !== 'string' ||
      payload.storeId.length === 0
    ) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Access Token이 유효하지 않습니다.',
      });
    }

    return payload;
  }

  verifyCustomerAccessToken(token: string): CustomerAccessTokenPayload {
    const payload = this.verify<CustomerAccessTokenPayload>(
      token,
      'JWT_ACCESS_TOKEN_SECRET',
    );

    if (
      payload.type !== 'access' ||
      payload.role !== 'customer' ||
      typeof payload.customerId !== 'string' ||
      payload.customerId.length === 0
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: '고객 토큰이 아닙니다.',
      });
    }

    return payload;
  }

  verifyRefreshToken(token: string): StoreRefreshTokenPayload {
    const payload = this.verify<StoreRefreshTokenPayload>(
      token,
      'JWT_REFRESH_TOKEN_SECRET',
    );

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Refresh Token이 유효하지 않습니다.',
      });
    }

    return payload;
  }

  verifyCustomerRefreshToken(token: string): CustomerRefreshTokenPayload {
    const payload = this.verify<CustomerRefreshTokenPayload>(
      token,
      'JWT_REFRESH_TOKEN_SECRET',
    );

    if (
      payload.type !== 'refresh' ||
      payload.role !== 'customer' ||
      typeof payload.customerId !== 'string' ||
      payload.customerId.length === 0
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'refreshToken이 유효하지 않습니다.',
      });
    }

    return payload;
  }

  verifyAdminAccessToken(token: string): AdminAccessTokenPayload {
    const payload = this.verify<AdminAccessTokenPayload>(
      token,
      'JWT_ADMIN_ACCESS_TOKEN_SECRET',
    );

    if (
      payload.type !== 'access' ||
      payload.role !== 'admin' ||
      typeof payload.adminId !== 'string' ||
      payload.adminId.length === 0
    ) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: '관리자 Access Token이 유효하지 않습니다.',
      });
    }

    return payload;
  }

  verifyAdminRefreshToken(token: string): AdminRefreshTokenPayload {
    const payload = this.verify<AdminRefreshTokenPayload>(
      token,
      'JWT_ADMIN_REFRESH_TOKEN_SECRET',
    );

    if (
      payload.type !== 'refresh' ||
      payload.role !== 'admin' ||
      typeof payload.adminId !== 'string' ||
      payload.adminId.length === 0
    ) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: '관리자 Refresh Token이 유효하지 않습니다.',
      });
    }

    return payload;
  }

  getAccessTokenExpiresInSeconds(): number {
    return toSeconds(
      this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_EXPIRES_IN'),
    );
  }

  /** 점주 refresh 토큰 만료 시각. 고객·관리자는 getRefreshTokenExpiresAt을 쓴다. */
  getStoreRefreshTokenExpiresAt(): Date {
    return new Date(
      Date.now() + this.getStoreRefreshTokenExpiresInSeconds() * 1000,
    );
  }

  private getStoreRefreshTokenExpiresInSeconds(): number {
    return toSeconds(
      this.configService.getOrThrow<string>('STORE_REFRESH_TOKEN_EXPIRES_IN'),
    );
  }

  getRefreshTokenExpiresAt(): Date {
    const seconds = toSeconds(
      this.configService.getOrThrow<string>('JWT_REFRESH_TOKEN_EXPIRES_IN'),
    );

    return new Date(Date.now() + seconds * 1000);
  }

  private verify<T extends object>(token: string, secretKey: string): T {
    try {
      return this.jwtService.verify<T>(token, {
        secret: this.configService.getOrThrow<string>(secretKey),
      });
    } catch (error) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: '토큰이 유효하지 않습니다.',
        details:
          error instanceof Error
            ? { message: error.message }
            : { message: 'Unknown token error' },
      });
    }
  }
}

const toSeconds = (duration: string): number => {
  const match = /^(\d+)([smhd])?$/.exec(duration);

  if (!match) {
    return 3600;
  }

  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return value * multipliers[unit];
};
