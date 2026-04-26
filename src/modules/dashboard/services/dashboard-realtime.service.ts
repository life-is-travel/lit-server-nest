import { Injectable } from '@nestjs/common';
import {
  reservations_payment_status,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { ACTIVE_RESERVATION_STATUSES } from '../dashboard.constants';
import { DashboardRealtimeResponseDto } from '../dto/dashboard-response.dto';
import {
  getKstDateRange,
  getKstDateString,
} from '../utils/kst-date-range.util';
import { DashboardStoreService } from './dashboard-store.service';

@Injectable()
export class DashboardRealtimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardStoreService: DashboardStoreService,
  ) {}

  async getRealtime(storeId: string): Promise<DashboardRealtimeResponseDto> {
    await this.dashboardStoreService.assertStoreExists(storeId);

    const todayRange = this.getTodayRange();
    const [
      status,
      activeReservations,
      pendingReservations,
      todayRevenue,
      occupiedStorages,
      availableStorages,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.store_status.findFirst({
        where: { store_id: storeId },
        orderBy: { updated_at: 'desc' },
        select: { status: true },
      }),
      this.prisma.reservations.count({
        where: {
          store_id: storeId,
          status: { in: ACTIVE_RESERVATION_STATUSES },
        },
      }),
      this.prisma.reservations.count({
        where: {
          store_id: storeId,
          status: reservations_status.pending,
        },
      }),
      this.prisma.reservations.aggregate({
        where: {
          store_id: storeId,
          payment_status: reservations_payment_status.paid,
          created_at: {
            gte: todayRange.start,
            lt: todayRange.endExclusive,
          },
        },
        _sum: { total_amount: true },
      }),
      this.prisma.storages.count({
        where: {
          store_id: storeId,
          status: storages_status.occupied,
        },
      }),
      this.prisma.storages.count({
        where: {
          store_id: storeId,
          status: storages_status.available,
        },
      }),
      this.prisma.notifications.count({
        where: {
          store_id: storeId,
          is_read: false,
        },
      }),
    ]);

    return {
      storeStatus: status?.status ?? 'closed',
      activeReservations,
      pendingReservations,
      todayRevenue: todayRevenue._sum.total_amount ?? 0,
      occupiedStorages,
      availableStorages,
      unreadNotifications,
      lastUpdated: new Date(),
    };
  }

  private getTodayRange() {
    const today = getKstDateString();

    return getKstDateRange({ from: today, to: today }, 1);
  }
}
