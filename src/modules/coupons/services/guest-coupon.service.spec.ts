/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { ForbiddenException } from '@nestjs/common';
import { coupons_status, coupons_type } from '@prisma/client';
import { GuestCouponService } from './guest-coupon.service';

const createCoupon = () => ({
  id: 'coup_1',
  customer_id: 'guest_phone_01012345678',
  store_id: 'store_1',
  type: coupons_type.store_benefit,
  title: '비회원 혜택',
  description: null,
  discount_amount: null,
  discount_rate: null,
  min_spend: null,
  max_discount: null,
  benefit_item: '사이다',
  benefit_value: '1개',
  status: coupons_status.active,
  issued_at: new Date('2026-01-01T00:00:00.000Z'),
  expires_at: new Date(Date.now() + 60_000),
  used_at: null,
  reservation_id: 'res_1',
  phone_snapshot: '01012345678',
  payment_id: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
});

const createService = () => {
  const prisma = {
    reservations: {
      findFirst: jest.fn(),
    },
    coupons: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const storePinService = {
    verifyPinForStore: jest.fn(),
  };

  return {
    service: new GuestCouponService(prisma as never, storePinService as never),
    prisma,
    storePinService,
  };
};

describe('GuestCouponService', () => {
  it('lists guest coupons after phone and reservation token verification', async () => {
    const { service, prisma } = createService();
    const coupon = createCoupon();

    prisma.reservations.findFirst.mockResolvedValue({ id: 'res_1' });
    prisma.coupons.updateMany.mockResolvedValue({ count: 0 });
    prisma.coupons.findMany.mockResolvedValue([coupon]);

    const result = await service.listCoupons({
      phoneNumber: '010-1234-5678',
      token: 'guest-token',
    });

    expect(prisma.reservations.findFirst).toHaveBeenCalledWith({
      where: {
        customer_phone: '01012345678',
        qr_code: 'guest-token',
      },
      select: { id: true },
    });
    expect(result.items[0]?.id).toBe('coup_1');
  });

  it('rejects guest coupon access when reservation token is invalid', async () => {
    const { service, prisma } = createService();

    prisma.coupons.findUnique.mockResolvedValue(createCoupon());
    prisma.reservations.findFirst.mockResolvedValue(null);

    await expect(
      service.getCoupon('coup_1', {
        phoneNumber: '01012345678',
        token: 'bad-token',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('redeems guest store benefit coupons after token and PIN verification', async () => {
    const { service, prisma, storePinService } = createService();
    const coupon = createCoupon();
    const usedCoupon = {
      ...coupon,
      status: coupons_status.used,
      used_at: new Date('2026-01-02T00:00:00.000Z'),
    };

    prisma.coupons.findUnique.mockResolvedValue(coupon);
    prisma.reservations.findFirst.mockResolvedValue({ id: 'res_1' });
    storePinService.verifyPinForStore.mockResolvedValue(undefined);
    prisma.coupons.updateMany.mockResolvedValue({ count: 1 });
    prisma.coupons.findUniqueOrThrow.mockResolvedValue(usedCoupon);

    const result = await service.redeemCoupon('coup_1', {
      phoneNumber: '010-1234-5678',
      token: 'guest-token',
      storePin: '1234',
    });

    expect(storePinService.verifyPinForStore).toHaveBeenCalledWith(
      'store_1',
      '1234',
    );
    expect(prisma.coupons.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'coup_1',
        phone_snapshot: '01012345678',
        status: coupons_status.active,
      },
      data: expect.objectContaining({
        status: coupons_status.used,
      }),
    });
    expect(result.status).toBe(coupons_status.used);
  });
});
