/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { hashInviteCode } from './utils/invite-code.util';
import { StaffService } from './staff.service';

const NOW = new Date('2026-10-06T03:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const activeStaff = (overrides: Record<string, unknown> = {}) => ({
  id: 'staff_1',
  store_id: 'store_1',
  name: '주말 알바 민수',
  status: 'active',
  joined_at: null,
  last_active_at: null,
  revoked_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const createService = () => {
  const tx = {
    store_staff: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...activeStaff(),
          ...data,
        })),
      update: jest.fn(),
    },
    store_staff_invite_codes: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    refresh_tokens: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const prisma = {
    store_staff: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    store_staff_invite_codes: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const tokenService = {
    generateStaffAccessToken: jest.fn().mockReturnValue('staff-access'),
    generateStaffRefreshToken: jest.fn().mockReturnValue('staff-refresh'),
    getStoreRefreshTokenExpiresAt: jest
      .fn()
      .mockReturnValue(new Date('2027-10-06T03:00:00.000Z')),
    getAccessTokenExpiresInSeconds: jest.fn().mockReturnValue(3600),
  };

  const service = new StaffService(prisma as never, tokenService as never);

  return { service, prisma, tx, tokenService };
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StaffService — 직원 관리', () => {
  it('creates a staff member and returns a one-time formatted invite code', async () => {
    const { service, tx } = createService();

    const result = await service.createStaff('store_1', { name: ' 민수 ' });

    expect(tx.store_staff.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ store_id: 'store_1', name: '민수' }),
    });
    expect(result.inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(result.expiresAt.getTime() - NOW.getTime()).toBe(24 * HOUR);

    const stored = tx.store_staff_invite_codes.create.mock.calls[0][0].data;
    expect(stored.code_hash).toBe(hashInviteCode(result.inviteCode));
    expect(JSON.stringify(stored)).not.toContain(
      result.inviteCode.replace('-', ''),
    );
    expect(result.staff).toMatchObject({ name: '민수', status: 'active' });
  });

  it('rejects an 11th active staff member', async () => {
    const { service, tx } = createService();
    tx.store_staff.count.mockResolvedValue(10);

    await expect(
      service.createStaff('store_1', { name: '열한번째' }),
    ).rejects.toMatchObject({ response: { code: 'STAFF_LIMIT_EXCEEDED' } });
    await expect(
      service.createStaff('store_1', { name: '열한번째' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.store_staff.create).not.toHaveBeenCalled();
  });

  it('lists staff with a pending invite only when an unused code is still valid', async () => {
    const { service, prisma } = createService();
    prisma.store_staff.findMany.mockResolvedValue([
      {
        ...activeStaff(),
        store_staff_invite_codes: [
          { expires_at: new Date(NOW.getTime() + HOUR) },
        ],
      },
      {
        ...activeStaff({ id: 'staff_2', joined_at: NOW, last_active_at: NOW }),
        store_staff_invite_codes: [],
      },
    ]);

    const result = await service.listStaff('store_1', false);

    expect(prisma.store_staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { store_id: 'store_1', status: 'active' },
      }),
    );
    expect(result.items[0].pendingInvite).toEqual({
      expiresAt: new Date(NOW.getTime() + HOUR),
    });
    expect(result.items[1]).toMatchObject({
      id: 'staff_2',
      joinedAt: NOW,
      pendingInvite: null,
    });
  });

  it('reissues a code and revokes the previous unused codes of that staff', async () => {
    const { service, prisma, tx } = createService();
    prisma.store_staff.findFirst.mockResolvedValue(activeStaff());

    const result = await service.reissueInviteCode('store_1', 'staff_1');

    expect(prisma.store_staff.findFirst).toHaveBeenCalledWith({
      where: { id: 'staff_1', store_id: 'store_1', status: 'active' },
    });
    expect(tx.store_staff_invite_codes.updateMany).toHaveBeenCalledWith({
      where: { staff_id: 'staff_1', used_at: null, revoked_at: null },
      data: { revoked_at: NOW },
    });
    expect(tx.store_staff_invite_codes.create).toHaveBeenCalled();
    expect(result.inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(tx.refresh_tokens.deleteMany).not.toHaveBeenCalled();
  });

  it('revokes a staff member: status, sessions and unused codes', async () => {
    const { service, prisma, tx } = createService();
    prisma.store_staff.findFirst.mockResolvedValue(activeStaff());

    await service.revokeStaff('store_1', 'staff_1');

    expect(tx.store_staff.update).toHaveBeenCalledWith({
      where: { id: 'staff_1' },
      data: expect.objectContaining({ status: 'revoked', revoked_at: NOW }),
    });
    expect(tx.refresh_tokens.deleteMany).toHaveBeenCalledWith({
      where: { staff_id: 'staff_1' },
    });
    expect(tx.store_staff_invite_codes.updateMany).toHaveBeenCalledWith({
      where: { staff_id: 'staff_1', used_at: null, revoked_at: null },
      data: { revoked_at: NOW },
    });
  });

  it('returns STAFF_NOT_FOUND for staff of another store or already revoked', async () => {
    const { service, prisma } = createService();
    prisma.store_staff.findFirst.mockResolvedValue(null);

    await expect(
      service.revokeStaff('store_1', 'staff_other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.reissueInviteCode('store_1', 'staff_other'),
    ).rejects.toMatchObject({ response: { code: 'STAFF_NOT_FOUND' } });
  });
});

describe('StaffService — 직원 시작·나가기', () => {
  const validInvite = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    staff_id: 'staff_1',
    store_id: 'store_1',
    code_hash: hashInviteCode('ABCDEFGH'),
    expires_at: new Date(NOW.getTime() + HOUR),
    used_at: null,
    revoked_at: null,
    store_staff: {
      ...activeStaff(),
      stores: {
        id: 'store_1',
        business_name: '루라운지',
        store_phone_number: '050700000000',
        address: '서울 용산구',
        detail_address: '1층',
        business_type: 'CAFE',
        has_completed_setup: true,
        profile_image_url: null,
        closed_at: null,
      },
    },
    ...overrides,
  });

  it('redeems a valid code into a staff session without owner private data', async () => {
    const { service, prisma, tx, tokenService } = createService();
    prisma.store_staff_invite_codes.findUnique.mockResolvedValue(validInvite());

    const result = await service.redeem({ code: 'abcd-efgh' });

    expect(prisma.store_staff_invite_codes.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code_hash: hashInviteCode('ABCDEFGH') },
      }),
    );
    // 동시에 같은 코드를 두 번 쓰지 못하게 used_at IS NULL 조건으로 사용 처리한다.
    expect(tx.store_staff_invite_codes.updateMany).toHaveBeenCalledWith({
      where: { id: 7, used_at: null, revoked_at: null },
      data: { used_at: NOW },
    });
    expect(tx.store_staff.update).toHaveBeenCalledWith({
      where: { id: 'staff_1' },
      data: expect.objectContaining({ joined_at: NOW, last_active_at: NOW }),
    });
    expect(tx.refresh_tokens.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        store_id: 'store_1',
        staff_id: 'staff_1',
        token: 'staff-refresh',
      }),
    });
    expect(tokenService.generateStaffAccessToken).toHaveBeenCalledWith(
      'store_1',
      'staff_1',
    );
    expect(result).toMatchObject({
      token: 'staff-access',
      refreshToken: 'staff-refresh',
      expiresIn: 3600,
      user_info: {
        id: 'store_1',
        storeId: 'store_1',
        role: 'staff',
        staffId: 'staff_1',
        staffName: '주말 알바 민수',
        businessName: '루라운지',
        email: null,
        phoneNumber: null,
        businessNumber: null,
        representativeName: null,
      },
    });
  });

  it('keeps the first joined_at when the same staff redeems again on a new device', async () => {
    const { service, prisma, tx } = createService();
    const firstJoined = new Date('2026-09-01T00:00:00.000Z');
    const invite = validInvite();
    invite.store_staff = { ...invite.store_staff, joined_at: firstJoined };
    prisma.store_staff_invite_codes.findUnique.mockResolvedValue(invite);

    await service.redeem({ code: 'ABCDEFGH' });

    expect(tx.store_staff.update.mock.calls[0][0].data).not.toHaveProperty(
      'joined_at',
    );
  });

  it.each([
    ['unknown code', null],
    ['expired code', validInvite({ expires_at: new Date(NOW.getTime() - 1) })],
    ['used code', validInvite({ used_at: NOW })],
    ['revoked code', validInvite({ revoked_at: NOW })],
  ])('answers INVITE_CODE_INVALID for %s', async (_label, invite) => {
    const { service, prisma, tx } = createService();
    prisma.store_staff_invite_codes.findUnique.mockResolvedValue(invite);

    const attempt = service.redeem({ code: 'ABCDEFGH' });

    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'INVITE_CODE_INVALID' },
    });
    expect(tx.refresh_tokens.create).not.toHaveBeenCalled();
  });

  it('answers INVITE_CODE_INVALID for a revoked staff or a withdrawn store', async () => {
    const { service, prisma } = createService();
    const revoked = validInvite();
    revoked.store_staff = { ...revoked.store_staff, status: 'revoked' };
    const closed = validInvite();
    closed.store_staff = {
      ...closed.store_staff,
      stores: { ...closed.store_staff.stores, closed_at: NOW },
    };

    for (const invite of [revoked, closed]) {
      prisma.store_staff_invite_codes.findUnique.mockResolvedValueOnce(invite);
      await expect(service.redeem({ code: 'ABCDEFGH' })).rejects.toMatchObject({
        response: { code: 'INVITE_CODE_INVALID' },
      });
    }
  });

  it('answers INVITE_CODE_INVALID when a concurrent redeem used the code first', async () => {
    const { service, prisma, tx } = createService();
    prisma.store_staff_invite_codes.findUnique.mockResolvedValue(validInvite());
    tx.store_staff_invite_codes.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.redeem({ code: 'ABCDEFGH' })).rejects.toMatchObject({
      response: { code: 'INVITE_CODE_INVALID' },
    });
    expect(tx.refresh_tokens.create).not.toHaveBeenCalled();
  });

  it('lets a staff member leave: revoke and anonymize the name', async () => {
    const { service, prisma, tx } = createService();
    prisma.store_staff.findFirst.mockResolvedValue(activeStaff());

    await service.leave('store_1', 'staff_1');

    expect(tx.store_staff.update).toHaveBeenCalledWith({
      where: { id: 'staff_1' },
      data: expect.objectContaining({
        status: 'revoked',
        name: '탈퇴한 직원',
        revoked_at: NOW,
      }),
    });
    expect(tx.refresh_tokens.deleteMany).toHaveBeenCalledWith({
      where: { staff_id: 'staff_1' },
    });
  });
});
