/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { stores } from '@prisma/client';
import { AuthService } from './auth.service';

const createStore = (): stores => ({
  id: 'store_1',
  email: 'store@example.com',
  password_hash: 'hashed-password',
  store_pin_hash: null,
  store_pin_updated_at: null,
  store_pin_failed_count: 0,
  store_pin_locked_until: null,
  phone_number: '01012345678',
  store_phone_number: '050700000000',
  notification_phone: '01099998888',
  notification_phones: ['01011112222', '01033334444'],
  wants_sms_notification: true,
  business_type: 'RESTAURANT',
  profile_image_url: 'https://cdn.example.com/logo.png',
  has_completed_setup: false,
  business_number: '1234567890',
  business_name: '루라운지 혼술바',
  slug: 'store-test',
  representative_name: '홍길동',
  address: '서울 용산구 한강대로44길 5',
  detail_address: '지하 1층',
  latitude: null,
  longitude: null,
  description: '매장 소개',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  last_login_at: null,
  login_count: 0,
  login_locked_until: null,
});

const createAuthService = () => {
  const tx = {
    stores: {
      update: jest.fn(),
    },
    refresh_tokens: {
      deleteMany: jest.fn(),
    },
    reservations: {
      count: jest.fn().mockResolvedValue(0),
    },
    store_settlement_accounts: {
      deleteMany: jest.fn(),
    },
    store_settings: {
      deleteMany: jest.fn(),
    },
    store_operating_hours: {
      deleteMany: jest.fn(),
    },
    notifications: {
      deleteMany: jest.fn(),
    },
    store_staff: {
      updateMany: jest.fn(),
    },
    store_staff_invite_codes: {
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    stores: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    store_staff: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refresh_tokens: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const emailVerificationService = {
    generateCode: jest.fn(),
    saveCode: jest.fn(),
    verifyCode: jest.fn(),
    assertEmailVerified: jest.fn(),
    toSaveError: jest.fn(),
  };
  const mailService = {
    sendVerificationEmail: jest.fn(),
  };
  const passwordService = {
    hash: jest.fn(),
    compare: jest.fn(),
  };
  const tokenService = {
    generateAccessToken: jest.fn().mockReturnValue('access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
    generateStaffAccessToken: jest.fn().mockReturnValue('staff-access-token'),
    getStoreRefreshTokenExpiresAt: jest
      .fn()
      .mockReturnValue(new Date('2026-02-01T00:00:00.000Z')),
    getAccessTokenExpiresInSeconds: jest.fn().mockReturnValue(3600),
    verifyRefreshToken: jest.fn(),
  };

  const service = new AuthService(
    prisma as never,
    emailVerificationService as never,
    mailService as never,
    passwordService,
    tokenService as never,
  );

  return {
    service,
    prisma,
    tx,
    passwordService,
    tokenService,
  };
};

describe('AuthService', () => {
  it('logs in a store and stores a refresh token', async () => {
    const { service, prisma, passwordService, tokenService } =
      createAuthService();
    const store = createStore();

    prisma.stores.findUnique.mockResolvedValue(store);
    passwordService.compare.mockResolvedValue(true);
    prisma.refresh_tokens.create.mockResolvedValue({});

    const result = await service.login({
      email: 'STORE@example.com',
      password: 'password123',
    });

    expect(prisma.stores.findUnique).toHaveBeenCalledWith({
      where: { email: 'store@example.com' },
    });
    expect(passwordService.compare).toHaveBeenCalledWith(
      'password123',
      'hashed-password',
    );
    expect(prisma.refresh_tokens.create).toHaveBeenCalledWith({
      data: {
        store_id: 'store_1',
        token: 'refresh-token',
        expires_at: new Date('2026-02-01T00:00:00.000Z'),
      },
    });
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      'store_1',
      'store@example.com',
    );
    expect(prisma.stores.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: expect.objectContaining({
        login_count: 0,
        login_locked_until: null,
      }),
    });
    expect(result).toMatchObject({
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      user_info: {
        role: 'owner',
        id: 'store_1',
        storeId: 'store_1',
        email: 'store@example.com',
        businessName: '루라운지 혼술바',
        // 앱이 로컬 캐시를 로그인 응답으로 덮어써도 값이 유지되도록
        // 알림 수신 번호·추가 수신자·로고가 반드시 포함되어야 한다.
        notificationPhone: '01099998888',
        notificationPhones: ['01011112222', '01033334444'],
        profileImageUrl: 'https://cdn.example.com/logo.png',
      },
    });
  });

  it('increments the failure count on a wrong password without locking', async () => {
    const { service, prisma, passwordService } = createAuthService();

    prisma.stores.findUnique.mockResolvedValue(createStore());
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'store@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTHENTICATION_FAILED' }),
    });
    expect(prisma.stores.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: expect.objectContaining({
        login_count: 1,
        login_locked_until: null,
      }),
    });
  });

  it('locks the account on the 5th consecutive failure', async () => {
    const { service, prisma, passwordService } = createAuthService();

    prisma.stores.findUnique.mockResolvedValue({
      ...createStore(),
      login_count: 4,
    });
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'store@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_LOCKED' }),
    });

    const updateArg = prisma.stores.update.mock.calls[0][0];
    expect(updateArg.data.login_count).toBe(5);
    expect(updateArg.data.login_locked_until).toBeInstanceOf(Date);
  });

  it('rejects login while the account is locked', async () => {
    const { service, prisma, passwordService } = createAuthService();

    prisma.stores.findUnique.mockResolvedValue({
      ...createStore(),
      login_count: 5,
      login_locked_until: new Date(Date.now() + 5 * 60_000),
    });

    await expect(
      service.login({
        email: 'store@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_LOCKED' }),
    });
    // 잠금 중에는 비밀번호 검증조차 수행하지 않는다.
    expect(passwordService.compare).not.toHaveBeenCalled();
    expect(prisma.stores.update).not.toHaveBeenCalled();
  });

  it('changes the password and revokes existing refresh tokens', async () => {
    const { service, prisma, tx, passwordService } = createAuthService();

    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_1',
      password_hash: 'old-hash',
    });
    passwordService.compare.mockResolvedValue(true);
    passwordService.hash.mockResolvedValue('new-hash');

    const result = await service.changePassword('store_1', {
      currentPassword: 'currentPassword123',
      newPassword: 'newPassword123',
    });

    expect(passwordService.compare).toHaveBeenCalledWith(
      'currentPassword123',
      'old-hash',
    );
    expect(tx.stores.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: expect.objectContaining({ password_hash: 'new-hash' }),
    });
    expect(tx.refresh_tokens.deleteMany).toHaveBeenCalledWith({
      where: { store_id: 'store_1' },
    });
    expect(result).toEqual({ message: '비밀번호가 변경되었습니다.' });
  });

  it('rejects password change when the current password does not match', async () => {
    const { service, prisma, tx, passwordService } = createAuthService();

    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_1',
      password_hash: 'old-hash',
    });
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.changePassword('store_1', {
        currentPassword: 'wrong-password',
        newPassword: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.stores.update).not.toHaveBeenCalled();
  });

  it('rejects password change when the store does not exist', async () => {
    const { service, prisma } = createAuthService();

    prisma.stores.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('store_unknown', {
        currentPassword: 'currentPassword123',
        newPassword: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('withdraw', () => {
    const withdrawableStore = {
      id: 'store_1',
      password_hash: 'old-hash',
      closed_at: null,
    };

    it('anonymizes the store, deletes personal data and keeps the row', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();

      prisma.stores.findUnique.mockResolvedValue(withdrawableStore);
      passwordService.compare.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue('unusable-hash');

      const result = await service.withdraw('store_1', {
        password: 'currentPassword123',
      });

      expect(passwordService.compare).toHaveBeenCalledWith(
        'currentPassword123',
        'old-hash',
      );
      expect(tx.reservations.count).toHaveBeenCalledWith({
        where: {
          store_id: 'store_1',
          status: {
            in: ['pending', 'pending_approval', 'confirmed', 'in_progress'],
          },
        },
      });
      for (const table of [
        tx.refresh_tokens,
        tx.store_settlement_accounts,
        tx.store_settings,
        tx.store_operating_hours,
        tx.notifications,
      ]) {
        expect(table.deleteMany).toHaveBeenCalledWith({
          where: { store_id: 'store_1' },
        });
      }
      expect(tx.stores.update).toHaveBeenCalledWith({
        where: { id: 'store_1' },
        data: expect.objectContaining({
          email: 'withdrawn_store_1@withdrawn.invalid',
          password_hash: 'unusable-hash',
          business_name: '폐점한 매장',
          store_pin_hash: null,
          phone_number: null,
          store_phone_number: null,
          notification_phone: null,
          wants_sms_notification: false,
          business_number: null,
          representative_name: null,
          address: null,
          detail_address: null,
          latitude: null,
          longitude: null,
          description: null,
          profile_image_url: null,
          slug: null,
          closed_at: expect.any(Date),
        }),
      });
      // 직원 세션은 refresh_tokens 전체 삭제에 포함되고, 직원·미사용 초대코드도 정리한다.
      expect(tx.store_staff.updateMany).toHaveBeenCalledWith({
        where: { store_id: 'store_1', status: 'active' },
        data: expect.objectContaining({ status: 'revoked' }),
      });
      expect(tx.store_staff_invite_codes.updateMany).toHaveBeenCalledWith({
        where: { store_id: 'store_1', used_at: null, revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
      expect(result).toEqual({ message: '회원탈퇴가 완료되었습니다.' });
    });

    it('rejects withdrawal when the password does not match', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();

      prisma.stores.findUnique.mockResolvedValue(withdrawableStore);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.withdraw('store_1', { password: 'wrong-password' }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CURRENT_PASSWORD' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.stores.update).not.toHaveBeenCalled();
    });

    it('blocks withdrawal while active reservations exist', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();

      prisma.stores.findUnique.mockResolvedValue(withdrawableStore);
      passwordService.compare.mockResolvedValue(true);
      tx.reservations.count.mockResolvedValue(3);

      const attempt = service.withdraw('store_1', { password: 'pw' });

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toMatchObject({
        response: {
          code: 'ACTIVE_RESERVATIONS_EXIST',
          details: { count: 3 },
        },
      });
      expect(tx.stores.update).not.toHaveBeenCalled();
      expect(tx.refresh_tokens.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects withdrawal for an unknown or already withdrawn store', async () => {
      const { service, prisma } = createAuthService();

      prisma.stores.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.withdraw('store_unknown', { password: 'pw' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.stores.findUnique.mockResolvedValueOnce({
        ...withdrawableStore,
        closed_at: new Date('2026-10-01T00:00:00.000Z'),
      });
      await expect(
        service.withdraw('store_1', { password: 'pw' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('refreshes an access token when the refresh token is valid', async () => {
    const { service, prisma, tokenService } = createAuthService();
    const expiresAt = new Date(Date.now() + 60_000);

    tokenService.verifyRefreshToken.mockReturnValue({
      storeId: 'store_1',
      email: 'store@example.com',
      type: 'refresh',
    });
    prisma.refresh_tokens.findFirst.mockResolvedValue({
      store_id: 'store_1',
      expires_at: expiresAt,
    });
    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_1',
      email: 'store@example.com',
    });

    const result = await service.refresh({ refreshToken: 'refresh-token' });

    expect(result).toEqual({
      token: 'access-token',
      expiresIn: 3600,
    });
  });
  describe('refresh — 직원 세션', () => {
    const staffRow = {
      store_id: 'store_1',
      staff_id: 'staff_1',
      expires_at: new Date(Date.now() + 60_000),
    };

    it('issues a staff access token and touches last_active_at for an active staff', async () => {
      const { service, prisma, tokenService } = createAuthService();
      tokenService.verifyRefreshToken.mockReturnValue({
        storeId: 'store_1',
        staffId: 'staff_1',
        role: 'staff',
        type: 'refresh',
      });
      prisma.refresh_tokens.findFirst.mockResolvedValue(staffRow);
      prisma.store_staff.findFirst.mockResolvedValue({ id: 'staff_1' });

      const result = await service.refresh({ refreshToken: 'staff-refresh' });

      expect(prisma.store_staff.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'staff_1',
          store_id: 'store_1',
          status: 'active',
          stores: { closed_at: null },
        },
        select: { id: true },
      });
      expect(tokenService.generateStaffAccessToken).toHaveBeenCalledWith(
        'store_1',
        'staff_1',
      );
      expect(prisma.store_staff.update).toHaveBeenCalledWith({
        where: { id: 'staff_1' },
        data: { last_active_at: expect.any(Date) },
      });
      expect(result).toEqual({ token: 'staff-access-token', expiresIn: 3600 });
    });

    it('rejects refresh for a revoked staff or withdrawn store', async () => {
      const { service, prisma, tokenService } = createAuthService();
      tokenService.verifyRefreshToken.mockReturnValue({
        storeId: 'store_1',
        staffId: 'staff_1',
        role: 'staff',
        type: 'refresh',
      });
      prisma.refresh_tokens.findFirst.mockResolvedValue(staffRow);
      prisma.store_staff.findFirst.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'staff-refresh' }),
      ).rejects.toMatchObject({ response: { code: 'STAFF_REVOKED' } });
      expect(tokenService.generateStaffAccessToken).not.toHaveBeenCalled();
    });

    it('does not use a staff refresh row for the owner path', async () => {
      const { service, prisma, tokenService } = createAuthService();
      tokenService.verifyRefreshToken.mockReturnValue({
        storeId: 'store_1',
        email: 'store@example.com',
        type: 'refresh',
      });
      prisma.refresh_tokens.findFirst.mockResolvedValue({
        store_id: 'store_1',
        staff_id: null,
        expires_at: new Date(Date.now() + 60_000),
      });
      prisma.stores.findUnique.mockResolvedValue({
        id: 'store_1',
        email: 'store@example.com',
      });

      await service.refresh({ refreshToken: 'refresh-token' });

      expect(prisma.store_staff.findFirst).not.toHaveBeenCalled();
      expect(tokenService.generateStaffAccessToken).not.toHaveBeenCalled();
    });
  });
});
