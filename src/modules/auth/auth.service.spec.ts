/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { stores } from '@prisma/client';
import { AuthService } from './auth.service';

const createStore = (overrides: Partial<stores> = {}): stores => ({
  id: 'store_1',
  owner_id: 'owner_1',
  email: 'store@example.com',
  password_hash: null,
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
  closed_at: null,
  ...overrides,
});

const createOwner = (overrides: Record<string, unknown> = {}) => ({
  id: 'owner_1',
  email: 'owner@example.com',
  password_hash: 'hashed-password',
  login_count: 0,
  login_locked_until: null as Date | null,
  last_login_at: null,
  withdrawn_at: null as Date | null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

/** findOwnerOfStore가 읽는 모양: 토큰 매장 + 그 점주 */
const ownedStore = (overrides: Record<string, unknown> = {}) => ({
  closed_at: null,
  owners: {
    id: 'owner_1',
    email: 'owner@example.com',
    password_hash: 'hashed-password',
    withdrawn_at: null,
  },
  ...overrides,
});

const summaries = [
  {
    id: 'store_1',
    business_name: '버터베이커리',
    profile_image_url: null,
    has_completed_setup: true,
  },
  {
    id: 'store_2',
    business_name: '슬로우버터',
    profile_image_url: null,
    has_completed_setup: false,
  },
];

const createAuthService = () => {
  const tx = {
    owners: {
      create: jest.fn(),
      update: jest.fn(),
    },
    stores: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Partial<stores> }) =>
          createStore(data),
        ),
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ id: 'store_1' }]),
      count: jest.fn().mockResolvedValue(2),
    },
    store_status: { create: jest.fn() },
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
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    store_operating_hours: {
      deleteMany: jest.fn(),
    },
    notifications: {
      deleteMany: jest.fn(),
    },
    store_push_devices: {
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
    owners: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stores: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue(summaries),
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
    hash: jest.fn().mockResolvedValue('new-hash'),
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
    emailVerificationService,
  };
};

describe('AuthService', () => {
  describe('login (F-026 점주 계정)', () => {
    it('점주로 로그인하면 최근 매장 토큰과 매장 목록을 준다', async () => {
      const { service, prisma, passwordService, tokenService } =
        createAuthService();
      prisma.owners.findUnique.mockResolvedValue(createOwner());
      passwordService.compare.mockResolvedValue(true);
      prisma.stores.findFirst.mockResolvedValue(createStore());

      const result = await service.login({
        email: ' Owner@Example.com ',
        password: 'password123',
      });

      expect(prisma.owners.findUnique).toHaveBeenCalledWith({
        where: { email: 'owner@example.com' },
      });
      expect(prisma.stores.findFirst).toHaveBeenCalledWith({
        where: { owner_id: 'owner_1', closed_at: null },
        orderBy: [
          { last_login_at: { sort: 'desc', nulls: 'last' } },
          { created_at: 'asc' },
        ],
      });
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
        'store_1',
        'owner@example.com',
      );
      expect(prisma.refresh_tokens.create).toHaveBeenCalledWith({
        data: {
          store_id: 'store_1',
          token: 'refresh-token',
          expires_at: new Date('2026-02-01T00:00:00.000Z'),
        },
      });
      expect(prisma.owners.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: expect.objectContaining({
          login_count: 0,
          login_locked_until: null,
        }),
      });
      expect(prisma.stores.update).toHaveBeenCalledWith({
        where: { id: 'store_1' },
        data: { last_login_at: expect.any(Date) },
      });
      expect(result.user_info).toEqual(
        expect.objectContaining({
          storeId: 'store_1',
          role: 'owner',
          email: 'owner@example.com',
          businessName: '루라운지 혼술바',
        }),
      );
      expect(result.stores).toEqual([
        {
          storeId: 'store_1',
          businessName: '버터베이커리',
          profileImageUrl: null,
          hasCompletedSetup: true,
        },
        {
          storeId: 'store_2',
          businessName: '슬로우버터',
          profileImageUrl: null,
          hasCompletedSetup: false,
        },
      ]);
    });

    it('없는 이메일·탈퇴한 점주는 같은 인증 실패로 거절한다', async () => {
      const { service, prisma } = createAuthService();
      prisma.owners.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'x@example.com', password: 'p' }),
      ).rejects.toMatchObject({ response: { code: 'AUTHENTICATION_FAILED' } });

      prisma.owners.findUnique.mockResolvedValueOnce(
        createOwner({ withdrawn_at: new Date() }),
      );
      await expect(
        service.login({ email: 'owner@example.com', password: 'p' }),
      ).rejects.toMatchObject({ response: { code: 'AUTHENTICATION_FAILED' } });
    });

    it('비밀번호가 틀리면 점주 실패 횟수를 올린다', async () => {
      const { service, prisma, passwordService } = createAuthService();
      prisma.owners.findUnique.mockResolvedValue(
        createOwner({ login_count: 2 }),
      );
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'owner@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({
        response: {
          code: 'AUTHENTICATION_FAILED',
          details: { remainingAttempts: 2 },
        },
      });
      expect(prisma.owners.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: expect.objectContaining({
          login_count: 3,
          login_locked_until: null,
        }),
      });
      expect(prisma.refresh_tokens.create).not.toHaveBeenCalled();
    });

    it('5번째 연속 실패에 잠근다', async () => {
      const { service, prisma, passwordService } = createAuthService();
      prisma.owners.findUnique.mockResolvedValue(
        createOwner({ login_count: 4 }),
      );
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'owner@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
      expect(prisma.owners.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: expect.objectContaining({
          login_count: 5,
          login_locked_until: expect.any(Date),
        }),
      });
    });

    it('잠긴 동안에는 비밀번호가 맞아도 거절한다', async () => {
      const { service, prisma, passwordService } = createAuthService();
      prisma.owners.findUnique.mockResolvedValue(
        createOwner({ login_locked_until: new Date(Date.now() + 60_000) }),
      );

      await expect(
        service.login({ email: 'owner@example.com', password: 'p' }),
      ).rejects.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('열린 매장이 없는 점주는 로그인할 수 없다', async () => {
      const { service, prisma, passwordService } = createAuthService();
      prisma.owners.findUnique.mockResolvedValue(createOwner());
      passwordService.compare.mockResolvedValue(true);
      prisma.stores.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'owner@example.com', password: 'p' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refresh_tokens.create).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('점주와 첫 매장을 함께 만든다', async () => {
      const { service, prisma, tx } = createAuthService();
      prisma.owners.findUnique.mockResolvedValue(null);

      const result = await service.register({
        email: 'New@Example.com',
        password: 'password123',
        businessName: ' 새 매장 ',
      });

      const ownerId = tx.owners.create.mock.calls[0][0].data.id as string;
      expect(ownerId).toMatch(/^owner_/);
      expect(tx.owners.create).toHaveBeenCalledWith({
        data: {
          id: ownerId,
          email: 'new@example.com',
          password_hash: 'new-hash',
        },
      });
      expect(tx.stores.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          owner_id: ownerId,
          email: 'new@example.com',
          business_name: '새 매장',
        }),
      });
      expect(result.user_info.email).toBe('new@example.com');
    });

    it('이미 있는 점주 이메일이면 거절한다', async () => {
      const { service, prisma, tx } = createAuthService();
      prisma.owners.findUnique.mockResolvedValue({ id: 'owner_1' });

      await expect(
        service.register({
          email: 'owner@example.com',
          password: 'password123',
          businessName: '새 매장',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.owners.create).not.toHaveBeenCalled();
    });
  });

  describe('다매장 (F-026)', () => {
    it('같은 점주의 다른 매장으로 전환하고 이전 refresh 토큰을 지운다', async () => {
      const { service, prisma, tokenService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      prisma.stores.findFirst.mockResolvedValue(
        createStore({ id: 'store_2', business_name: '슬로우버터' }),
      );

      const result = await service.switchStore(
        'store_1',
        'store_2',
        'old-refresh',
      );

      expect(prisma.stores.findFirst).toHaveBeenCalledWith({
        where: { id: 'store_2', owner_id: 'owner_1', closed_at: null },
      });
      expect(prisma.refresh_tokens.deleteMany).toHaveBeenCalledWith({
        where: {
          token: 'old-refresh',
          staff_id: null,
          stores: { owner_id: 'owner_1' },
        },
      });
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
        'store_2',
        'owner@example.com',
      );
      expect(result.user_info.storeId).toBe('store_2');
    });

    it('다른 점주 매장이나 닫힌 매장으로는 전환할 수 없다', async () => {
      const { service, prisma } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      prisma.stores.findFirst.mockResolvedValue(null);

      await expect(
        service.switchStore('store_1', 'store_other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.refresh_tokens.create).not.toHaveBeenCalled();
    });

    it('매장을 추가하면 같은 점주 아래 이메일 없이 만들고 그 매장 토큰을 준다', async () => {
      const { service, prisma, tx } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());

      const result = await service.addStore('store_1', {
        businessName: '슬로우버터',
      });

      expect(tx.stores.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          owner_id: 'owner_1',
          email: null,
          business_name: '슬로우버터',
          has_completed_setup: false,
        }),
      });
      expect(tx.store_status.create).toHaveBeenCalled();
      expect(tx.store_settings.create).toHaveBeenCalled();
      expect(result.user_info.businessName).toBe('슬로우버터');
      expect(result.user_info.email).toBe('owner@example.com');
    });

    it('목록은 같은 점주의 열린 매장을 만든 순서로 준다', async () => {
      const { service, prisma } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());

      const result = await service.listOwnerStores('store_1');

      expect(prisma.stores.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { owner_id: 'owner_1', closed_at: null },
          orderBy: { created_at: 'asc' },
        }),
      );
      expect(result.map((s) => s.storeId)).toEqual(['store_1', 'store_2']);
    });

    it('탈퇴한 점주의 매장 토큰으로는 다매장 API를 쓸 수 없다', async () => {
      const { service, prisma } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(
        ownedStore({
          owners: { ...ownedStore().owners, withdrawn_at: new Date() },
        }),
      );

      await expect(service.listOwnerStores('store_1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('changePassword', () => {
    it('점주 비밀번호를 바꾸고 그 점주 모든 매장의 점주 세션만 끊는다', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(true);

      await service.changePassword('store_1', {
        currentPassword: 'old',
        newPassword: 'new-password',
      });

      expect(tx.owners.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: { password_hash: 'new-hash', updated_at: expect.any(Date) },
      });
      expect(tx.refresh_tokens.deleteMany).toHaveBeenCalledWith({
        where: { staff_id: null, stores: { owner_id: 'owner_1' } },
      });
    });

    it('현재 비밀번호가 틀리면 거절한다', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('store_1', {
          currentPassword: 'wrong',
          newPassword: 'new-password',
        }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CURRENT_PASSWORD' },
      });
      expect(tx.owners.update).not.toHaveBeenCalled();
    });

    it('없는 매장이면 404', async () => {
      const { service, prisma } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('store_x', {
          currentPassword: 'a',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('withdraw (점주 계정 탈퇴)', () => {
    it('점주의 모든 열린 매장을 익명화·폐점하고 점주를 익명화한다', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(true);
      tx.stores.findMany.mockResolvedValue([
        { id: 'store_1' },
        { id: 'store_2' },
      ]);

      await expect(
        service.withdraw('store_1', { password: 'pw' }),
      ).resolves.toEqual({ message: '회원탈퇴가 완료되었습니다.' });

      expect(tx.reservations.count).toHaveBeenCalledWith({
        where: {
          store_id: { in: ['store_1', 'store_2'] },
          status: {
            in: ['pending', 'pending_approval', 'confirmed', 'in_progress'],
          },
        },
      });
      for (const storeId of ['store_1', 'store_2']) {
        for (const table of [
          tx.refresh_tokens,
          tx.store_settlement_accounts,
          tx.store_settings,
          tx.store_operating_hours,
          tx.notifications,
          tx.store_push_devices,
        ]) {
          expect(table.deleteMany).toHaveBeenCalledWith({
            where: { store_id: storeId },
          });
        }
        expect(tx.stores.update).toHaveBeenCalledWith({
          where: { id: storeId },
          data: expect.objectContaining({
            email: `withdrawn_${storeId}@withdrawn.invalid`,
            business_name: '폐점한 매장',
            business_number: null,
            closed_at: expect.any(Date),
          }),
        });
        expect(tx.store_staff.updateMany).toHaveBeenCalledWith({
          where: { store_id: storeId },
          data: { name: '탈퇴한 직원', updated_at: expect.any(Date) },
        });
      }
      expect(tx.store_push_devices.deleteMany).toHaveBeenCalledWith({
        where: { owner_id: 'owner_1' },
      });
      expect(tx.owners.update).toHaveBeenCalledWith({
        where: { id: 'owner_1' },
        data: expect.objectContaining({
          email: 'withdrawn_owner_1@withdrawn.invalid',
          password_hash: 'new-hash',
          withdrawn_at: expect.any(Date),
        }),
      });
    });

    it('어느 매장이든 진행 중 예약이 있으면 아무것도 바꾸지 않는다', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(true);
      tx.reservations.count.mockResolvedValue(3);

      await expect(
        service.withdraw('store_1', { password: 'pw' }),
      ).rejects.toMatchObject({
        response: { code: 'ACTIVE_RESERVATIONS_EXIST', details: { count: 3 } },
      });
      expect(tx.stores.update).not.toHaveBeenCalled();
      expect(tx.owners.update).not.toHaveBeenCalled();
    });

    it('비밀번호가 틀리면 거절한다', async () => {
      const { service, prisma, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.withdraw('store_1', { password: 'wrong' }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CURRENT_PASSWORD' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('이미 폐점한 매장 토큰이면 404', async () => {
      const { service, prisma } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(
        ownedStore({ closed_at: new Date() }),
      );

      await expect(
        service.withdraw('store_1', { password: 'pw' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('closeStore (매장 하나 폐점)', () => {
    it('토큰의 매장만 익명화·폐점하고 점주는 그대로 둔다', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(true);
      tx.stores.count.mockResolvedValue(2);

      await expect(
        service.closeStore('store_1', { password: 'pw' }),
      ).resolves.toEqual({ message: '매장이 폐점되었습니다.' });

      expect(tx.stores.update).toHaveBeenCalledTimes(1);
      expect(tx.stores.update).toHaveBeenCalledWith({
        where: { id: 'store_1' },
        data: expect.objectContaining({ closed_at: expect.any(Date) }),
      });
      expect(tx.owners.update).not.toHaveBeenCalled();
    });

    it('마지막 열린 매장이면 409 LAST_STORE', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(true);
      tx.stores.count.mockResolvedValue(1);

      await expect(
        service.closeStore('store_1', { password: 'pw' }),
      ).rejects.toMatchObject({ response: { code: 'LAST_STORE' } });
      expect(tx.stores.update).not.toHaveBeenCalled();
    });

    it('그 매장에 진행 중 예약이 있으면 폐점할 수 없다', async () => {
      const { service, prisma, tx, passwordService } = createAuthService();
      prisma.stores.findUnique.mockResolvedValue(ownedStore());
      passwordService.compare.mockResolvedValue(true);
      tx.reservations.count.mockResolvedValue(1);

      await expect(
        service.closeStore('store_1', { password: 'pw' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.reservations.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ store_id: { in: ['store_1'] } }),
        }),
      );
    });
  });

  it('refresh는 점주 이메일로 access 토큰을 다시 만든다', async () => {
    const { service, prisma, tokenService } = createAuthService();
    tokenService.verifyRefreshToken.mockReturnValue({
      storeId: 'store_1',
      type: 'refresh',
    });
    prisma.refresh_tokens.findFirst.mockResolvedValue({
      store_id: 'store_1',
      expires_at: new Date(Date.now() + 60_000),
    });
    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_1',
      owners: { email: 'owner@example.com' },
    });

    const result = await service.refresh({ refreshToken: 'refresh-token' });

    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
      'store_1',
      'owner@example.com',
    );
    expect(result).toEqual({ token: 'access-token', expiresIn: 3600 });
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
  });
});
