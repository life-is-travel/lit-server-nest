import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  StoreAccessTokenPayload,
  StoreRefreshTokenPayload,
} from '../types/store-token-payload.type';

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

    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Access Token이 유효하지 않습니다.',
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

  getAccessTokenExpiresInSeconds(): number {
    return toSeconds(
      this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_EXPIRES_IN'),
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
