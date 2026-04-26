/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  reservations_payment_status,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { DashboardRealtimeService } from './dashboard-realtime.service';

const createDashboardRealtimeService = () => {
  const prisma = {
    store_status: {
      findFirst: jest.fn(),
    },
    reservations: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    storages: {
      count: jest.fn(),
    },
    notifications: {
      count: jest.fn(),
    },
  };
  const dashboardStoreService = {
    assertStoreExists: jest.fn(),
  };

  return {
    service: new DashboardRealtimeService(
      prisma as never,
      dashboardStoreService as never,
    ),
    prisma,
    dashboardStoreService,
  };
};

describe('DashboardRealtimeService', () => {
  it('returns Express-compatible realtime dashboard data', async () => {
    const { service, prisma, dashboardStoreService } =
      createDashboardRealtimeService();

    dashboardStoreService.assertStoreExists.mockResolvedValue(undefined);
    prisma.store_status.findFirst.mockResolvedValue({ status: 'open' });
    prisma.reservations.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.reservations.aggregate.mockResolvedValue({
      _sum: { total_amount: 15000 },
    });
    prisma.storages.count.mockResolvedValueOnce(5).mockResolvedValueOnce(12);
    prisma.notifications.count.mockResolvedValue(7);

    const result = await service.getRealtime('store_1');

    expect(dashboardStoreService.assertStoreExists).toHaveBeenCalledWith(
      'store_1',
    );
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
    expect(prisma.storages.count).toHaveBeenCalledWith({
      where: {
        store_id: 'store_1',
        status: storages_status.occupied,
      },
    });
    expect(result).toMatchObject({
      storeStatus: 'open',
      activeReservations: 3,
      pendingReservations: 2,
      todayRevenue: 15000,
      occupiedStorages: 5,
      availableStorages: 12,
      unreadNotifications: 7,
    });
    expect(result.lastUpdated).toBeInstanceOf(Date);
  });
});
