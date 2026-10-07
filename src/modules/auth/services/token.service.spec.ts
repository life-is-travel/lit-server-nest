import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

const ENV: Record<string, string> = {
  JWT_ACCESS_TOKEN_SECRET: 'store-access-secret-value-over-32-characters',
  JWT_REFRESH_TOKEN_SECRET: 'store-refresh-secret-value-over-32-characters',
  JWT_ADMIN_ACCESS_TOKEN_SECRET: 'admin-access-secret-value-over-32-characters',
  JWT_ADMIN_REFRESH_TOKEN_SECRET:
    'admin-refresh-secret-value-over-32-characters',
  JWT_ACCESS_TOKEN_EXPIRES_IN: '1h',
  JWT_REFRESH_TOKEN_EXPIRES_IN: '30d',
  STORE_REFRESH_TOKEN_EXPIRES_IN: '365d',
};

const createTokenService = () => {
  const configService = {
    getOrThrow: (key: string) => {
      const value = ENV[key];

      if (value === undefined) {
        throw new Error(`missing env ${key}`);
      }

      return value;
    },
  } as unknown as ConfigService;
  const jwtService = new JwtService({});

  return { service: new TokenService(configService, jwtService), jwtService };
};

describe('TokenService (admin tokens)', () => {
  it('round-trips an admin access token', () => {
    const { service } = createTokenService();

    const token = service.generateAdminAccessToken('adm_1', 'ops@example.com');

    expect(service.verifyAdminAccessToken(token)).toMatchObject({
      adminId: 'adm_1',
      email: 'ops@example.com',
      role: 'admin',
      type: 'access',
    });
  });

  it('round-trips an admin refresh token', () => {
    const { service } = createTokenService();

    const token = service.generateAdminRefreshToken('adm_1', 'ops@example.com');

    expect(service.verifyAdminRefreshToken(token)).toMatchObject({
      adminId: 'adm_1',
      role: 'admin',
      type: 'refresh',
    });
  });

  it('rejects a store access token as an admin token (different secret)', () => {
    const { service } = createTokenService();

    const storeToken = service.generateAccessToken(
      'store_1',
      'store@example.com',
    );

    expect(() => service.verifyAdminAccessToken(storeToken)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an admin access token on the store verifier', () => {
    const { service } = createTokenService();

    const adminToken = service.generateAdminAccessToken(
      'adm_1',
      'ops@example.com',
    );

    expect(() => service.verifyAccessToken(adminToken)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an admin refresh token on the admin access verifier', () => {
    const { service } = createTokenService();

    const refreshToken = service.generateAdminRefreshToken(
      'adm_1',
      'ops@example.com',
    );

    expect(() => service.verifyAdminAccessToken(refreshToken)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with the admin secret but a non-admin role', () => {
    const { service, jwtService } = createTokenService();
    const forged = jwtService.sign(
      {
        adminId: 'adm_1',
        email: 'x@example.com',
        role: 'customer',
        type: 'access',
      },
      { secret: ENV.JWT_ADMIN_ACCESS_TOKEN_SECRET, expiresIn: 60 },
    );

    let caught: unknown;

    try {
      service.verifyAdminAccessToken(forged);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught as UnauthorizedException).getResponse()).toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });
});

const DAY = 24 * 60 * 60;

const lifetimeSeconds = (jwtService: JwtService, token: string): number => {
  const decoded = jwtService.decode<{ iat: number; exp: number }>(token);
  return decoded.exp - decoded.iat;
};

describe('TokenService (store refresh lifetime)', () => {
  it('issues owner refresh tokens for STORE_REFRESH_TOKEN_EXPIRES_IN', () => {
    const { service, jwtService } = createTokenService();

    expect(
      lifetimeSeconds(
        jwtService,
        service.generateRefreshToken('store_1', 'owner@example.com'),
      ),
    ).toBe(365 * DAY);

    const expiresAt = service.getStoreRefreshTokenExpiresAt().getTime();
    expect(expiresAt - Date.now()).toBeGreaterThan(364 * DAY * 1000);
  });

  it('keeps customer refresh tokens on JWT_REFRESH_TOKEN_EXPIRES_IN', () => {
    const { service, jwtService } = createTokenService();

    expect(
      lifetimeSeconds(
        jwtService,
        service.generateCustomerRefreshToken('customer_1'),
      ),
    ).toBe(30 * DAY);
  });
});
