import { Injectable } from '@nestjs/common';
import {
  reservations_payment_status,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import {
  DashboardStatsPeriod,
  DashboardStatsQueryDto,
} from '../dto/dashboard-query.dto';
import { DashboardStatsResponseDto } from '../dto/dashboard-response.dto';
import {
  getKstDateRange,
  getKstDateString,
} from '../utils/kst-date-range.util';
import { DashboardStoreService } from './dashboard-store.service';

@Injectable()
export class DashboardStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardStoreService: DashboardStoreService,
  ) {}

  async getStats(
    storeId: string,
    query: DashboardStatsQueryDto,
  ): Promise<DashboardStatsResponseDto> {
    await this.dashboardStoreService.assertStoreExists(storeId);

    const period = query.period ?? DashboardStatsPeriod.Monthly;
    const range = this.getPeriodRange(period);
    const [revenue, reservationCounts, occupancy, review] = await Promise.all([
      this.prisma.reservations.aggregate({
        where: {
          store_id: storeId,
          payment_status: reservations_payment_status.paid,
          created_at: {
            gte: range.start,
            lt: range.endExclusive,
          },
        },
        _sum: { total_amount: true },
        _avg: { total_amount: true },
        _count: { _all: true },
      }),
      this.prisma.reservations.groupBy({
        by: ['status'],
        where: {
          store_id: storeId,
          created_at: {
            gte: range.start,
            lt: range.endExclusive,
          },
        },
        _count: { _all: true },
      }),
      this.prisma.storages.groupBy({
        by: ['status'],
        where: { store_id: storeId },
        _count: { _all: true },
      }),
      this.prisma.reviews.aggregate({
        where: { store_id: storeId },
        _avg: { rating: true },
        _count: {
          _all: true,
          response: true,
        },
      }),
    ]);

    const totalReservations = this.sumReservationGroupCounts(reservationCounts);
    const completedReservations = this.getReservationGroupCount(
      reservationCounts,
      reservations_status.completed,
    );
    const cancelledReservations = this.getReservationGroupCount(
      reservationCounts,
      reservations_status.cancelled,
    );
    const totalStorages = this.sumStorageGroupCounts(occupancy);
    const occupiedStorages = this.getStorageGroupCount(
      occupancy,
      storages_status.occupied,
    );
    const totalReviews = review._count._all;
    const respondedReviews = review._count.response;

    return {
      period,
      revenue: {
        total: revenue._sum.total_amount ?? 0,
        average: Math.round(revenue._avg.total_amount ?? 0),
        count: revenue._count._all,
        growth: 0,
      },
      reservations: {
        total: totalReservations,
        completed: completedReservations,
        cancelled: cancelledReservations,
        completionRate:
          totalReservations > 0
            ? Number(
                ((completedReservations / totalReservations) * 100).toFixed(1),
              )
            : 0,
      },
      occupancy: {
        average:
          totalStorages > 0
            ? (occupiedStorages / totalStorages).toFixed(2)
            : '0.00',
        peak: 0,
        peakTime: null,
      },
      customerSatisfaction: {
        averageRating: Number(review._avg.rating ?? 0).toFixed(1),
        totalReviews,
        responseRate:
          totalReviews > 0
            ? Number(((respondedReviews / totalReviews) * 100).toFixed(1))
            : 0,
      },
    };
  }

  private getPeriodRange(period: DashboardStatsPeriod) {
    const today = getKstDateString();

    switch (period) {
      case DashboardStatsPeriod.Daily:
        return getKstDateRange({ from: today, to: today }, 1);
      case DashboardStatsPeriod.Weekly:
        return getKstDateRange({ to: today }, 7);
      case DashboardStatsPeriod.Yearly:
        return getKstDateRange({
          from: `${today.slice(0, 4)}-01-01`,
          to: today,
        });
      case DashboardStatsPeriod.Monthly:
      default:
        return getKstDateRange({ from: `${today.slice(0, 7)}-01`, to: today });
    }
  }

  private sumReservationGroupCounts(
    rows: Array<{ _count: { _all: number } }>,
  ): number {
    return rows.reduce((sum, row) => sum + row._count._all, 0);
  }

  private getReservationGroupCount(
    rows: Array<{
      status: reservations_status | null;
      _count: { _all: number };
    }>,
    status: reservations_status,
  ): number {
    return rows.find((row) => row.status === status)?._count._all ?? 0;
  }

  private sumStorageGroupCounts(
    rows: Array<{ _count: { _all: number } }>,
  ): number {
    return rows.reduce((sum, row) => sum + row._count._all, 0);
  }

  private getStorageGroupCount(
    rows: Array<{ status: storages_status | null; _count: { _all: number } }>,
    status: storages_status,
  ): number {
    return rows.find((row) => row.status === status)?._count._all ?? 0;
  }
}
