import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STAFF_ALLOWED_KEY } from '../decorators/staff-allowed.decorator';
import { StoreAuthGuard } from './store-auth.guard';

const OWNER = {
  storeId: 'store_1',
  email: 'o@example.com',
  role: 'owner',
  type: 'access',
};
const STAFF = {
  storeId: 'store_1',
  staffId: 'staff_1',
  role: 'staff',
  type: 'access',
};

const createGuard = (
  payload: Record<string, unknown>,
  staffAllowed: boolean,
  // null이면 Authorization 헤더 없이 요청한다.
  authorization: string | null = 'Bearer access-token',
) => {
  const tokenService = {
    verifyAccessToken: jest.fn().mockReturnValue(payload),
  };
  const getAllAndOverride = jest.fn().mockReturnValue(staffAllowed);
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const prisma = {
    store_staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff_1' }) },
  };
  const request: Record<string, unknown> = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;

  const guard = new StoreAuthGuard(
    tokenService as never,
    reflector,
    prisma as never,
  );

  return { guard, context, request, prisma, getAllAndOverride, tokenService };
};

describe('StoreAuthGuard', () => {
  // 기존 동작(변경 전 테스트를 새 생성자에 맞춰 유지)
  it('attaches the verified store payload to the request', async () => {
    const { guard, context, request, tokenService } = createGuard(OWNER, false);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(request).toMatchObject({ store: OWNER, storeId: 'store_1' });
  });

  it('rejects requests without an authorization header', async () => {
    const { guard, context } = createGuard(OWNER, false, null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects malformed authorization headers', async () => {
    const { guard, context } = createGuard(OWNER, false, 'Token access-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets owners through every store API without a DB lookup', async () => {
    const { guard, context, request, prisma } = createGuard(OWNER, false);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.storeId).toBe('store_1');
    expect(prisma.store_staff.findFirst).not.toHaveBeenCalled();
  });

  it('denies staff by default on APIs not marked @StaffAllowed', async () => {
    const { guard, context, prisma, getAllAndOverride } = createGuard(
      STAFF,
      false,
    );

    const attempt = guard.canActivate(context);

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'OWNER_ONLY' },
    });
    expect(getAllAndOverride).toHaveBeenCalledWith(STAFF_ALLOWED_KEY, [
      'handler',
      'class',
    ]);
    expect(prisma.store_staff.findFirst).not.toHaveBeenCalled();
  });

  it('lets an active staff member through @StaffAllowed APIs', async () => {
    const { guard, context, request, prisma } = createGuard(STAFF, true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.store_staff.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'staff_1',
        store_id: 'store_1',
        status: 'active',
        stores: { closed_at: null },
      },
      select: { id: true },
    });
    expect(request.storeId).toBe('store_1');
    expect(request.store).toMatchObject({ role: 'staff', staffId: 'staff_1' });
  });

  it('rejects a revoked staff member or a withdrawn store immediately', async () => {
    const { guard, context, prisma } = createGuard(STAFF, true);
    prisma.store_staff.findFirst.mockResolvedValue(null);

    const attempt = guard.canActivate(context);

    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'STAFF_REVOKED' },
    });
  });
});
