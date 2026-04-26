/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  reservations_payment_status,
  reservations_status,
} from '@prisma/client';
import { DashboardSummaryService } from './dashboard-summary.service';

const createDashboardSummaryService = () => {
  const prisma = {
    reservations: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    storages: {
      count: jest.fn(),
    },
  };
  const dashboardStoreService = {
    getStoreOrThrow: jest.fn(),
  };

  return {
    service: new DashboardSummaryService(
      prisma as never,
      dashboardStoreService as never,
    ),
    prisma,
    dashboardStoreService,
  };
};

describe('DashboardSummaryService', () => {
  it('returns an Express-compatible dashboard summary', async () => {
    const { service, prisma, dashboardStoreService } =
      createDashboardSummaryService();
    const createdAt = new Date('2026-04-01T00:00:00.000Z');
    const updatedAt = new Date('2026-04-02T00:00:00.000Z');

    dashboardStoreService.getStoreOrThrow.mockResolvedValue({
      business_name: '테스트 매장',
      created_at: createdAt,
      updated_at: updatedAt,
    });
    prisma.reservations.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    prisma.reservations.aggregate
      .mockResolvedValueOnce({ _sum: { total_amount: 100000 } })
      .mockResolvedValueOnce({ _sum: { total_amount: 15000 } });
    prisma.storages.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(5);

    const result = await service.getSummary('store_1');

    expect(prisma.reservations.count).toHaveBeenCalledWith({
      where: {
        store_id: 'store_1',
        status: {
          in: [reservations_status.confirmed, reservations_status.in_progress],
        },
      },
    });
    expect(prisma.reservations.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          store_id: 'store_1',
          payment_status: reservations_payment_status.paid,
        }),
      }),
    );
    expect(result).toMatchObject({
      storeName: '테스트 매장',
      totalReservations: 10,
      pendingReservations: 2,
      activeReservations: 3,
      completedReservations: 4,
      todayReservations: 1,
      totalRevenue: 100000,
      todayRevenue: 15000,
      totalStorages: 20,
      availableStorages: 12,
      occupiedStorages: 5,
      occupancyRate: 0.25,
      createdAt,
      updatedAt,
    });
  });
});
