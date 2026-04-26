/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  reservations_payment_status,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { DashboardStatsPeriod } from '../dto/dashboard-query.dto';
import { DashboardStatsService } from './dashboard-stats.service';

const createDashboardStatsService = () => {
  const prisma = {
    reservations: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    storages: {
      groupBy: jest.fn(),
    },
    reviews: {
      aggregate: jest.fn(),
    },
  };
  const dashboardStoreService = {
    assertStoreExists: jest.fn(),
  };

  return {
    service: new DashboardStatsService(
      prisma as never,
      dashboardStoreService as never,
    ),
    prisma,
    dashboardStoreService,
  };
};

describe('DashboardStatsService', () => {
  it('returns Express-compatible dashboard stats for the selected period', async () => {
    const { service, prisma, dashboardStoreService } =
      createDashboardStatsService();

    dashboardStoreService.assertStoreExists.mockResolvedValue(undefined);
    prisma.reservations.aggregate.mockResolvedValue({
      _sum: { total_amount: 30000 },
      _avg: { total_amount: 10000 },
      _count: { _all: 3 },
    });
    prisma.reservations.groupBy.mockResolvedValue([
      { status: reservations_status.completed, _count: { _all: 2 } },
      { status: reservations_status.cancelled, _count: { _all: 1 } },
    ]);
    prisma.storages.groupBy.mockResolvedValue([
      { status: storages_status.available, _count: { _all: 3 } },
      { status: storages_status.occupied, _count: { _all: 1 } },
    ]);
    prisma.reviews.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { _all: 4, response: 3 },
    });

    const result = await service.getStats('store_1', {
      period: DashboardStatsPeriod.Monthly,
    });

    expect(dashboardStoreService.assertStoreExists).toHaveBeenCalledWith(
      'store_1',
    );
    expect(prisma.reservations.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          store_id: 'store_1',
          payment_status: reservations_payment_status.paid,
        }),
      }),
    );
    expect(result).toEqual({
      period: DashboardStatsPeriod.Monthly,
      revenue: {
        total: 30000,
        average: 10000,
        count: 3,
        growth: 0,
      },
      reservations: {
        total: 3,
        completed: 2,
        cancelled: 1,
        completionRate: 66.7,
      },
      occupancy: {
        average: '0.25',
        peak: 0,
        peakTime: null,
      },
      customerSatisfaction: {
        averageRating: '4.5',
        totalReviews: 4,
        responseRate: 75,
      },
    });
  });
});
