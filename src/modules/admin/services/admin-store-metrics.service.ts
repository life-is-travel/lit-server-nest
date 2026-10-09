import { Injectable } from '@nestjs/common';
import {
  Prisma,
  payments_status,
  reservations_payment_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import {
  getKstDateRange,
  KstDateRange,
} from '../../dashboard/utils/kst-date-range.util';
import { ADMIN_DEFAULT_RANGE_DAYS } from '../admin.constants';
import {
  AdminDateRangeQueryDto,
  AdminLocaleBreakdownDto,
  AdminSortOrder,
  AdminStoreListItemDto,
  AdminStoreListQueryDto,
  AdminStoreListResponseDto,
  AdminStoreSortBy,
  AdminStoreSummaryResponseDto,
  StoreOpsMetricsDto,
} from '../dto/admin-store-ops.dto';
import {
  toAdminStoreListItem,
  toAdminStoreSummaryStore,
} from '../mappers/admin-store.mapper';
import {
  buildMetrics,
  coalesceStatus,
  emptyMetricsInput,
  MetricsInput,
  representativeReservationWhere,
  sumMetricsInputs,
} from '../utils/store-ops-metrics.util';
import { ADMIN_STORE_SELECT, AdminStoreService } from './admin-store.service';

/** PG 총매출(gross) 대상. 환불·취소된 결제도 paid_at 기준 매출에는 남긴다. */
const PAYMENT_REVENUE_STATUSES: payments_status[] = [
  payments_status.SUCCESS,
  payments_status.CANCELED,
  payments_status.REFUNDED,
];

const PAYMENT_REFUND_STATUSES: payments_status[] = [
  payments_status.CANCELED,
  payments_status.REFUNDED,
];

type AggregateOptions = {
  /** 지정하면 해당 매장만, 생략하면 전체 매장. */
  storeIds?: string[];
  includeLocale: boolean;
};

type StoreAggregation = {
  inputs: Map<string, MetricsInput>;
  localeBreakdown: AdminLocaleBreakdownDto[];
};

type LocaleRow = { locale: string; _count: { _all: number } };

type SortValue = number | string | null;

/**
 * 4.1 매장별 운영 현황 목록 · 4.2 매장 요약 (store-operations.md §7.2).
 * 두 엔드포인트는 aggregateByStore 하나를 공유하므로 같은 기간의 숫자가 항상 같다.
 */
@Injectable()
export class AdminStoreMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminStoreService: AdminStoreService,
  ) {}

  async listStores(
    query: AdminStoreListQueryDto,
  ): Promise<AdminStoreListResponseDto> {
    const range = getKstDateRange(query, ADMIN_DEFAULT_RANGE_DAYS);
    const { where: storeWhere, filtered } = this.buildStoreWhere(query);
    const stores = await this.prisma.stores.findMany({
      where: storeWhere,
      select: ADMIN_STORE_SELECT,
    });
    const storeIds = stores.map((store) => store.id);
    const [statuses, aggregation] = await Promise.all([
      this.adminStoreService.getLatestStatuses(storeIds),
      this.aggregateByStore(range, {
        // 필터가 없으면 store_id IN (...)을 생략해 전체 매장을 한 번에 집계한다.
        storeIds: filtered ? storeIds : undefined,
        includeLocale: true,
      }),
    ]);

    const inputs = stores.map(
      (store) => aggregation.inputs.get(store.id) ?? emptyMetricsInput(),
    );
    const items = stores.map((store, index) =>
      toAdminStoreListItem(
        store,
        AdminStoreService.resolveStatus(statuses, store.id),
        buildMetrics(inputs[index]),
      ),
    );
    const sorted = this.sortItems(items, query.sortBy, query.sortOrder);
    const offset = (query.page - 1) * query.limit;

    return {
      items: sorted.slice(offset, offset + query.limit),
      page: query.page,
      limit: query.limit,
      total: stores.length,
      meta: {
        range: { from: range.from, to: range.to },
        // 합산 분자/분모로 비율을 재계산한다(매장별 비율의 평균이 아님).
        totals: buildMetrics(sumMetricsInputs(inputs)),
        activeStoreCount: items.filter(
          (item) => item.metrics.reservationCount >= 1,
        ).length,
        localeBreakdown: aggregation.localeBreakdown,
      },
    };
  }

  async getStoreSummary(
    storeId: string,
    query: AdminDateRangeQueryDto,
  ): Promise<AdminStoreSummaryResponseDto> {
    const range = getKstDateRange(query, ADMIN_DEFAULT_RANGE_DAYS);
    const store = await this.adminStoreService.getStoreOrThrow(storeId);
    const [statuses, aggregation] = await Promise.all([
      this.adminStoreService.getLatestStatuses([storeId]),
      this.aggregateByStore(range, {
        storeIds: [storeId],
        includeLocale: false,
      }),
    ]);

    return {
      store: toAdminStoreSummaryStore(
        store,
        AdminStoreService.resolveStatus(statuses, storeId),
      ),
      range: { from: range.from, to: range.to },
      metrics: buildMetrics(
        aggregation.inputs.get(storeId) ?? emptyMetricsInput(),
      ),
    };
  }

  /**
   * 기간 내 매장별 원시 집계(§7.2 3~7번 쿼리). 결과는 데이터가 있는 매장만 담기며,
   * 호출자가 없는 매장을 emptyMetricsInput()으로 채운다.
   */
  private async aggregateByStore(
    range: KstDateRange,
    options: AggregateOptions,
  ): Promise<StoreAggregation> {
    const createdAt = { gte: range.start, lt: range.endExclusive };
    const storeScope: Prisma.reservationsWhereInput &
      Prisma.paymentsWhereInput = options.storeIds
      ? { store_id: { in: options.storeIds } }
      : {};
    const representative = representativeReservationWhere(this.prisma);
    const representativeInRange: Prisma.reservationsWhereInput = {
      ...storeScope,
      created_at: createdAt,
      ...representative,
    };

    const [revenueRows, statusRows, paymentRows, refundRows, localeRows] =
      await Promise.all([
        this.prisma.reservations.groupBy({
          by: ['store_id'],
          where: {
            ...storeScope,
            payment_status: reservations_payment_status.paid,
            created_at: createdAt,
          },
          _sum: { total_amount: true },
        }),
        this.prisma.reservations.groupBy({
          by: ['store_id', 'status'],
          where: representativeInRange,
          _count: { _all: true },
        }),
        this.prisma.payments.groupBy({
          by: ['store_id'],
          where: {
            ...storeScope,
            status: { in: PAYMENT_REVENUE_STATUSES },
            paid_at: createdAt,
          },
          _sum: { amount_total: true },
          _count: { _all: true },
        }),
        this.prisma.payments.groupBy({
          by: ['store_id'],
          where: {
            ...storeScope,
            status: { in: PAYMENT_REFUND_STATUSES },
            canceled_at: createdAt,
          },
          _sum: { amount_total: true },
        }),
        options.includeLocale
          ? this.prisma.reservations.groupBy({
              by: ['locale'],
              where: representativeInRange,
              _count: { _all: true },
            })
          : Promise.resolve<LocaleRow[]>([]),
      ]);

    const inputs = new Map<string, MetricsInput>();
    const inputOf = (storeId: string): MetricsInput => {
      let input = inputs.get(storeId);

      if (!input) {
        input = emptyMetricsInput();
        inputs.set(storeId, input);
      }

      return input;
    };

    for (const row of revenueRows) {
      inputOf(row.store_id).reservationRevenue = row._sum.total_amount ?? 0;
    }

    for (const row of statusRows) {
      // status NULL 행은 pending으로 합산되므로 += 로 누적한다.
      inputOf(row.store_id).statusCounts[coalesceStatus(row.status)] +=
        row._count._all;
    }

    for (const row of paymentRows) {
      const input = inputOf(row.store_id);
      input.paymentRevenue = row._sum.amount_total ?? 0;
      input.paymentCount = row._count._all;
    }

    for (const row of refundRows) {
      inputOf(row.store_id).refundedAmount = row._sum.amount_total ?? 0;
    }

    const localeBreakdown = localeRows
      .map((row) => ({
        locale: row.locale,
        reservationCount: row._count._all,
      }))
      .sort(
        (a, b) =>
          b.reservationCount - a.reservationCount ||
          a.locale.localeCompare(b.locale),
      );

    return { inputs, localeBreakdown };
  }

  private buildStoreWhere(query: AdminStoreListQueryDto): {
    where: Prisma.storesWhereInput;
    filtered: boolean;
  } {
    // 탈퇴한 매장(closed_at)은 항상 제외한다. 사용자 필터가 없으면 집계는 전체 매장을 대상으로 한다.
    const conditions: Prisma.storesWhereInput[] = [{ closed_at: null }];

    if (query.search) {
      // MySQL collation이 대소문자를 무시하므로 mode: 'insensitive'는 쓰지 않는다.
      conditions.push({ business_name: { contains: query.search } });
    }

    if (query.hasCompletedSetup === true) {
      conditions.push({ has_completed_setup: true });
    } else if (query.hasCompletedSetup === false) {
      conditions.push({
        OR: [{ has_completed_setup: false }, { has_completed_setup: null }],
      });
    }

    return { where: { AND: conditions }, filtered: conditions.length > 1 };
  }

  /**
   * 1차 sortBy(방향 적용), 2차 businessName asc, 3차 storeId asc.
   * 비율 null은 정렬 방향과 무관하게 항상 마지막.
   */
  private sortItems(
    items: AdminStoreListItemDto[],
    sortBy: AdminStoreSortBy,
    sortOrder: AdminSortOrder,
  ): AdminStoreListItemDto[] {
    const direction = sortOrder === AdminSortOrder.Asc ? 1 : -1;

    return [...items].sort((a, b) => {
      const primary = this.comparePrimary(
        this.sortValue(a, sortBy),
        this.sortValue(b, sortBy),
        direction,
      );

      if (primary !== 0) {
        return primary;
      }

      const byName = a.businessName.localeCompare(b.businessName, 'ko');

      if (byName !== 0) {
        return byName;
      }

      return a.storeId < b.storeId ? -1 : a.storeId > b.storeId ? 1 : 0;
    });
  }

  private sortValue(
    item: AdminStoreListItemDto,
    sortBy: AdminStoreSortBy,
  ): SortValue {
    switch (sortBy) {
      case AdminStoreSortBy.BusinessName:
        return item.businessName;
      case AdminStoreSortBy.CreatedAt:
        return item.createdAt ? item.createdAt.getTime() : null;
      default:
        return item.metrics[sortBy as keyof StoreOpsMetricsDto];
    }
  }

  private comparePrimary(
    a: SortValue,
    b: SortValue,
    direction: number,
  ): number {
    if (a === null && b === null) {
      return 0;
    }

    if (a === null) {
      return 1;
    }

    if (b === null) {
      return -1;
    }

    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b, 'ko') * direction;
    }

    return ((a as number) - (b as number)) * direction;
  }
}
