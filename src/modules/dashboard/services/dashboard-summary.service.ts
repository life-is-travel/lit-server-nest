import { Injectable } from '@nestjs/common';
import {
  reservations_payment_status,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { ACTIVE_RESERVATION_STATUSES } from '../dashboard.constants';
import { DashboardSummaryResponseDto } from '../dto/dashboard-response.dto';
import {
  getKstDateRange,
  getKstDateString,
} from '../utils/kst-date-range.util';
import { DashboardStoreService } from './dashboard-store.service';

@Injectable()
export class DashboardSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardStoreService: DashboardStoreService,
  ) {}

  async getSummary(storeId: string): Promise<DashboardSummaryResponseDto> {
    const store = await this.dashboardStoreService.getStoreOrThrow(storeId);
    const todayRange = this.getTodayRange();
    const [
      totalReservations,
      pendingReservations,
      activeReservations,
      completedReservations,
      todayReservations,
      revenue,
      todayRevenue,
      totalStorages,
      availableStorages,
      occupiedStorages,
    ] = await Promise.all([
      this.prisma.reservations.count({ where: { store_id: storeId } }),
      this.prisma.reservations.count({
        where: {
          store_id: storeId,
          status: reservations_status.pending,
        },
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
          status: reservations_status.completed,
        },
      }),
      this.prisma.reservations.count({
        where: {
          store_id: storeId,
          created_at: {
            gte: todayRange.start,
            lt: todayRange.endExclusive,
          },
        },
      }),
      this.prisma.reservations.aggregate({
        where: {
          store_id: storeId,
          payment_status: reservations_payment_status.paid,
        },
        _sum: { total_amount: true },
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
      this.prisma.storages.count({ where: { store_id: storeId } }),
      this.prisma.storages.count({
        where: {
          store_id: storeId,
          status: storages_status.available,
        },
      }),
      this.prisma.storages.count({
        where: {
          store_id: storeId,
          status: storages_status.occupied,
        },
      }),
    ]);

    return {
      storeName: store.business_name || '',
      totalReservations,
      pendingReservations,
      activeReservations,
      completedReservations,
      todayReservations,
      totalRevenue: revenue._sum.total_amount ?? 0,
      todayRevenue: todayRevenue._sum.total_amount ?? 0,
      totalStorages,
      availableStorages,
      occupiedStorages,
      occupancyRate:
        totalStorages > 0
          ? Number((occupiedStorages / totalStorages).toFixed(2))
          : 0,
      createdAt: store.created_at,
      updatedAt: store.updated_at,
    };
  }

  private getTodayRange() {
    const today = getKstDateString();

    return getKstDateRange({ from: today, to: today }, 1);
  }
}
