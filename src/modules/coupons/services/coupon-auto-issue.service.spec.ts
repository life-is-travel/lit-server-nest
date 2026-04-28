/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  coupon_policies_auto_issue_on,
  coupon_policies_type,
} from '@prisma/client';
import { CouponAutoIssueService } from './coupon-auto-issue.service';

const createService = () => {
  const prisma = {
    coupon_policies: {
      findMany: jest.fn(),
    },
    coupons: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  return {
    service: new CouponAutoIssueService(prisma as never),
    prisma,
  };
};

describe('CouponAutoIssueService', () => {
  it('skips guest reservations without customerId', async () => {
    const { service, prisma } = createService();

    const result = await service.issueForTrigger({
      customerId: null,
      storeId: 'store_1',
      trigger: coupon_policies_auto_issue_on.checkin_completed,
      reservationId: 'res_1',
    });

    expect(result).toEqual([]);
    expect(prisma.coupon_policies.findMany).not.toHaveBeenCalled();
  });

  it('issues coupons for login customer checkin policies', async () => {
    const { service, prisma } = createService();

    prisma.coupon_policies.findMany.mockResolvedValue([
      {
        id: 'coup_pol_1',
        store_id: 'store_1',
        name: '체크인 혜택',
        type: coupon_policies_type.store_benefit,
        discount_amount: null,
        discount_rate: null,
        min_spend: null,
        max_discount: null,
        benefit_item: '사이다',
        benefit_value: '1개',
        auto_issue_on: coupon_policies_auto_issue_on.checkin_completed,
        validity_days: 7,
        enabled: 1,
      },
    ]);
    prisma.coupons.findFirst.mockResolvedValue(null);
    prisma.coupons.create.mockResolvedValue({});

    const result = await service.issueForTrigger({
      customerId: 'customer_1',
      storeId: 'store_1',
      trigger: coupon_policies_auto_issue_on.checkin_completed,
      reservationId: 'res_1',
    });

    expect(result).toHaveLength(1);
    expect(prisma.coupon_policies.findMany).toHaveBeenCalledWith({
      where: {
        auto_issue_on: coupon_policies_auto_issue_on.checkin_completed,
        enabled: 1,
        OR: [{ store_id: null }, { store_id: 'store_1' }],
      },
    });
    expect(prisma.coupons.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customer_id: 'customer_1',
        store_id: 'store_1',
        title: '체크인 혜택',
        reservation_id: 'res_1',
      }),
    });
  });

  it('issues phone based coupons for guest checkin policies', async () => {
    const { service, prisma } = createService();

    prisma.coupon_policies.findMany.mockResolvedValue([
      {
        id: 'coup_pol_1',
        store_id: 'store_1',
        name: '비회원 체크인 혜택',
        type: coupon_policies_type.store_benefit,
        discount_amount: null,
        discount_rate: null,
        min_spend: null,
        max_discount: null,
        benefit_item: '사이다',
        benefit_value: '1개',
        auto_issue_on: coupon_policies_auto_issue_on.checkin_completed,
        validity_days: 7,
        enabled: 1,
      },
    ]);
    prisma.coupons.findFirst.mockResolvedValue(null);
    prisma.coupons.create.mockResolvedValue({});

    const result = await service.issueGuestCouponsForTrigger({
      phoneSnapshot: '010-1234-5678',
      storeId: 'store_1',
      trigger: coupon_policies_auto_issue_on.checkin_completed,
      reservationId: 'res_1',
    });

    expect(result).toHaveLength(1);
    expect(prisma.coupons.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        customer_id: 'guest_phone_01012345678',
        phone_snapshot: '01012345678',
        reservation_id: 'res_1',
      }),
      select: { id: true },
    });
    expect(prisma.coupons.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customer_id: 'guest_phone_01012345678',
        phone_snapshot: '01012345678',
        store_id: 'store_1',
        title: '비회원 체크인 혜택',
        reservation_id: 'res_1',
      }),
    });
  });
});
