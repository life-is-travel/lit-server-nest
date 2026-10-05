/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  payments_status,
  reservations_payment_status,
  reservations_status,
  store_status_status,
} from '@prisma/client';
import {
  AdminSortOrder,
  AdminStoreListQueryDto,
  AdminStoreSortBy,
} from '../dto/admin-store-ops.dto';
import { AdminStoreMetricsService } from './admin-store-metrics.service';

const ID_REF = { __fieldRef: 'reservations.id' };
const RANGE_START = new Date('2026-08-31T15:00:00.000Z');
const RANGE_END = new Date('2026-09-30T15:00:00.000Z');

type Fixtures = {
  stores?: Array<Record<string, unknown>>;
  revenueRows?: Array<{
    store_id: string;
    _sum: { total_amount: number | null };
  }>;
  statusRows?: Array<{
    store_id: string;
    status: reservations_status | null;
    _count: { _all: number };
  }>;
  paymentRows?: Array<{
    store_id: string;
    _sum: { amount_total: number | null };
    _count: { _all: number };
  }>;
  refundRows?: Array<{
    store_id: string;
    _sum: { amount_total: number | null };
  }>;
  localeRows?: Array<{ locale: string; _count: { _all: number } }>;
  statuses?: Map<string, store_status_status>;
};

const createStore = (id: string, businessName: string, extra = {}) => ({
  id,
  business_name: businessName,
  email: `${id}@example.com`,
  business_type: null,
  business_number: null,
  representative_name: null,
  address: null,
  phone_number: null,
  store_phone_number: null,
  has_completed_setup: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  last_login_at: null,
  ...extra,
});

const createService = (fixtures: Fixtures = {}) => {
  const prisma = {
    stores: {
      findMany: jest.fn().mockResolvedValue(fixtures.stores ?? []),
    },
    reservations: {
      fields: { id: ID_REF },
      groupBy: jest.fn((args: { by: string[] }) => {
        if (args.by.includes('locale')) {
          return Promise.resolve(fixtures.localeRows ?? []);
        }

        if (args.by.includes('status')) {
          return Promise.resolve(fixtures.statusRows ?? []);
        }

        return Promise.resolve(fixtures.revenueRows ?? []);
      }),
    },
    payments: {
      groupBy: jest.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          'paid_at' in args.where
            ? (fixtures.paymentRows ?? [])
            : (fixtures.refundRows ?? []),
        ),
      ),
    },
  };
  const adminStoreService = {
    getStoreOrThrow: jest.fn(),
    getLatestStatuses: jest
      .fn()
      .mockResolvedValue(fixtures.statuses ?? new Map()),
  };
  const service = new AdminStoreMetricsService(
    prisma as never,
    adminStoreService as never,
  );

  return { service, prisma, adminStoreService };
};

const listQuery = (
  overrides: Partial<AdminStoreListQueryDto> = {},
): AdminStoreListQueryDto => ({
  from: '2026-09-01',
  to: '2026-09-30',
  sortBy: AdminStoreSortBy.ReservationRevenue,
  sortOrder: AdminSortOrder.Desc,
  page: 1,
  limit: 20,
  ...overrides,
});

const groupByCall = (
  prisma: ReturnType<typeof createService>['prisma'],
  model: 'reservations' | 'payments',
  predicate: (args: any) => boolean,
) => prisma[model].groupBy.mock.calls.map((call) => call[0]).find(predicate);

describe('AdminStoreMetricsService', () => {
  describe('listStores — aggregation', () => {
    const fixtures: Fixtures = {
      stores: [
        createStore('store_a', '홍대 짐보관소'),
        createStore('store_b', '강남 짐보관소'),
        createStore('store_c', '을지로 짐보관소'), // 데이터 없음
      ],
      revenueRows: [
        { store_id: 'store_a', _sum: { total_amount: 100000 } },
        { store_id: 'store_b', _sum: { total_amount: 40000 } },
      ],
      statusRows: [
        {
          store_id: 'store_a',
          status: reservations_status.completed,
          _count: { _all: 6 },
        },
        {
          store_id: 'store_a',
          status: reservations_status.no_show,
          _count: { _all: 2 },
        },
        {
          store_id: 'store_a',
          status: reservations_status.pending,
          _count: { _all: 1 },
        },
        { store_id: 'store_a', status: null, _count: { _all: 1 } }, // NULL → pending
        {
          store_id: 'store_a',
          status: reservations_status.cancelled,
          _count: { _all: 1 },
        },
        {
          store_id: 'store_b',
          status: reservations_status.completed,
          _count: { _all: 2 },
        },
        {
          store_id: 'store_b',
          status: reservations_status.rejected,
          _count: { _all: 1 },
        },
        {
          store_id: 'store_b',
          status: reservations_status.in_progress,
          _count: { _all: 1 },
        },
      ],
      paymentRows: [
        {
          store_id: 'store_a',
          _sum: { amount_total: 80000 },
          _count: { _all: 5 },
        },
      ],
      refundRows: [{ store_id: 'store_a', _sum: { amount_total: 10000 } }],
      localeRows: [
        { locale: 'ko', _count: { _all: 5 } },
        { locale: 'en', _count: { _all: 8 } },
        { locale: 'ja', _count: { _all: 2 } },
      ],
      statuses: new Map([['store_a', store_status_status.open]]),
    };

    it('merges the groupBy results into per-store metrics and fills missing stores with zeros', async () => {
      const { service } = createService(fixtures);

      const result = await service.listStores(listQuery());

      expect(result.items.map((item) => item.storeId)).toEqual([
        'store_a',
        'store_b',
        'store_c',
      ]);
      expect(result.items[0]).toMatchObject({
        storeId: 'store_a',
        businessName: '홍대 짐보관소',
        storeStatus: 'open',
        hasCompletedSetup: true,
        metrics: {
          reservationRevenue: 100000,
          paymentRevenue: 80000,
          refundedAmount: 10000,
          paymentCount: 5,
          reservationCount: 11,
          pendingCount: 2,
          activeCount: 0,
          completedCount: 6,
          cancelledCount: 1,
          rejectedCount: 0,
          noShowCount: 2,
          noShowRate: 25,
          completionRate: 54.5,
          cancellationRate: 9.1,
        },
      });
      expect(result.items[1].metrics).toMatchObject({
        reservationRevenue: 40000,
        paymentRevenue: 0,
        reservationCount: 4,
        activeCount: 1,
        completedCount: 2,
        rejectedCount: 1,
        noShowRate: 0,
        cancellationRate: 25,
      });
      expect(result.items[2]).toMatchObject({
        storeId: 'store_c',
        storeStatus: 'closed',
        metrics: {
          reservationRevenue: 0,
          reservationCount: 0,
          noShowRate: null,
          completionRate: null,
          cancellationRate: null,
        },
      });
      expect(result).toMatchObject({ page: 1, limit: 20, total: 3 });
      expect(result.meta.range).toEqual({
        from: '2026-09-01',
        to: '2026-09-30',
      });
    });

    it('keeps the invariant reservationCount = sum of status counts for every item', async () => {
      const { service } = createService(fixtures);

      const { items, meta } = await service.listStores(listQuery());

      for (const { metrics } of [...items, { metrics: meta.totals }]) {
        expect(metrics.reservationCount).toBe(
          metrics.pendingCount +
            metrics.activeCount +
            metrics.completedCount +
            metrics.cancelledCount +
            metrics.rejectedCount +
            metrics.noShowCount,
        );
      }
    });

    it('recomputes meta.totals from summed numerators/denominators (weighted, over all filtered stores)', async () => {
      const { service } = createService(fixtures);

      const { meta } = await service.listStores(listQuery({ limit: 1 }));

      expect(meta.totals).toMatchObject({
        reservationRevenue: 140000,
        paymentRevenue: 80000,
        refundedAmount: 10000,
        paymentCount: 5,
        reservationCount: 15,
        completedCount: 8,
        noShowCount: 2,
        noShowRate: 20, // 2 / (8 + 2), not mean(25, 0)
        completionRate: 53.3,
        cancellationRate: 13.3,
      });
    });

    it('counts activeStoreCount as stores with reservationCount >= 1', async () => {
      const { service } = createService(fixtures);

      const { meta, total } = await service.listStores(listQuery());

      expect(meta.activeStoreCount).toBe(2);
      expect(total - meta.activeStoreCount).toBe(1);
    });

    it('returns localeBreakdown sorted by count desc then locale asc, summing to totals.reservationCount', async () => {
      const { service } = createService({
        ...fixtures,
        localeRows: [
          { locale: 'ko', _count: { _all: 5 } },
          { locale: 'zh', _count: { _all: 2 } },
          { locale: 'en', _count: { _all: 6 } },
          { locale: 'ja', _count: { _all: 2 } },
        ],
      });

      const { meta } = await service.listStores(listQuery());

      expect(meta.localeBreakdown).toEqual([
        { locale: 'en', reservationCount: 6 },
        { locale: 'ko', reservationCount: 5 },
        { locale: 'ja', reservationCount: 2 },
        { locale: 'zh', reservationCount: 2 },
      ]);
      expect(
        meta.localeBreakdown.reduce(
          (sum, row) => sum + row.reservationCount,
          0,
        ),
      ).toBe(meta.totals.reservationCount);
    });

    it('returns an empty localeBreakdown and null rates when nothing was reserved', async () => {
      const { service } = createService({
        stores: [createStore('store_a', 'A')],
      });

      const { items, meta } = await service.listStores(listQuery());

      expect(meta.localeBreakdown).toEqual([]);
      expect(meta.activeStoreCount).toBe(0);
      expect(meta.totals.noShowRate).toBeNull();
      expect(items[0].metrics.reservationCount).toBe(0);
    });
  });

  describe('listStores — query shape', () => {
    it('scopes revenue to paid rows and counts only representative rows within the KST range', async () => {
      const { service, prisma } = createService({
        stores: [createStore('store_a', 'A')],
      });

      await service.listStores(listQuery());

      const revenue = groupByCall(
        prisma,
        'reservations',
        (args) => args.by.length === 1 && args.by[0] === 'store_id',
      );
      expect(revenue).toEqual({
        by: ['store_id'],
        where: {
          payment_status: reservations_payment_status.paid,
          created_at: { gte: RANGE_START, lt: RANGE_END },
        },
        _sum: { total_amount: true },
      });

      const byStatus = groupByCall(prisma, 'reservations', (args) =>
        args.by.includes('status'),
      );
      expect(byStatus).toEqual({
        by: ['store_id', 'status'],
        where: {
          created_at: { gte: RANGE_START, lt: RANGE_END },
          OR: [
            { reservation_group_id: null },
            { reservation_group_id: { equals: ID_REF } },
          ],
        },
        _count: { _all: true },
      });

      const paid = groupByCall(
        prisma,
        'payments',
        (args) => 'paid_at' in args.where,
      );
      expect(paid).toEqual({
        by: ['store_id'],
        where: {
          status: {
            in: [
              payments_status.SUCCESS,
              payments_status.CANCELED,
              payments_status.REFUNDED,
            ],
          },
          paid_at: { gte: RANGE_START, lt: RANGE_END },
        },
        _sum: { amount_total: true },
        _count: { _all: true },
      });

      const refunded = groupByCall(
        prisma,
        'payments',
        (args) => 'canceled_at' in args.where,
      );
      expect(refunded).toEqual({
        by: ['store_id'],
        where: {
          status: { in: [payments_status.CANCELED, payments_status.REFUNDED] },
          canceled_at: { gte: RANGE_START, lt: RANGE_END },
        },
        _sum: { amount_total: true },
      });

      // 필터가 없으면 전체 매장을 집계하므로 store_id IN 이 붙지 않는다.
      expect(prisma.stores.findMany).toHaveBeenCalledWith({
        where: { AND: [{ closed_at: null }] },
        select: expect.any(Object),
      });
      expect(revenue.where).not.toHaveProperty('store_id');
    });

    it('applies search as business_name contains and scopes every groupBy to the matched store ids', async () => {
      const { service, prisma } = createService({
        stores: [createStore('store_a', '홍대 짐보관소')],
      });

      await service.listStores(listQuery({ search: '홍대' }));

      expect(prisma.stores.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{ closed_at: null }, { business_name: { contains: '홍대' } }],
        },
        select: expect.any(Object),
      });

      for (const call of [
        ...prisma.reservations.groupBy.mock.calls,
        ...prisma.payments.groupBy.mock.calls,
      ]) {
        expect(call[0].where.store_id).toEqual({ in: ['store_a'] });
      }
    });

    it('maps hasCompletedSetup=false to false OR NULL', async () => {
      const { service, prisma } = createService();

      await service.listStores(listQuery({ hasCompletedSetup: false }));

      expect(prisma.stores.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { closed_at: null },
            {
              OR: [
                { has_completed_setup: false },
                { has_completed_setup: null },
              ],
            },
          ],
        },
        select: expect.any(Object),
      });
    });

    it('propagates DATE_RANGE_TOO_LARGE before touching the database', async () => {
      const { service, prisma } = createService();

      const promise = service.listStores(
        listQuery({ from: '2025-01-01', to: '2026-12-31' }),
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'DATE_RANGE_TOO_LARGE' },
      });
      expect(prisma.stores.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listStores — sorting and paging', () => {
    const sortingFixtures: Fixtures = {
      stores: [
        createStore('store_1', '가', {
          created_at: new Date('2026-03-01T00:00:00.000Z'),
        }),
        createStore('store_2', '나', { created_at: null }),
        createStore('store_3', '다', {
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        }),
        createStore('store_4', '가', {
          created_at: new Date('2026-02-01T00:00:00.000Z'),
        }),
      ],
      revenueRows: [
        { store_id: 'store_1', _sum: { total_amount: 300 } },
        { store_id: 'store_2', _sum: { total_amount: 100 } },
        { store_id: 'store_3', _sum: { total_amount: 300 } },
      ],
      statusRows: [
        {
          store_id: 'store_1',
          status: reservations_status.completed,
          _count: { _all: 3 },
        },
        {
          store_id: 'store_1',
          status: reservations_status.no_show,
          _count: { _all: 1 },
        }, // 25%
        {
          store_id: 'store_2',
          status: reservations_status.completed,
          _count: { _all: 1 },
        }, // 0%
        {
          store_id: 'store_3',
          status: reservations_status.cancelled,
          _count: { _all: 2 },
        }, // null
      ],
    };

    const idsFor = async (overrides: Partial<AdminStoreListQueryDto>) => {
      const { service } = createService(sortingFixtures);
      const { items } = await service.listStores(listQuery(overrides));

      return items.map((item) => item.storeId);
    };

    it('sorts by reservationRevenue desc by default with businessName asc then storeId asc as tie-breakers', async () => {
      // store_1(300, 가) 와 store_3(300, 다) 동률 → 이름 asc. store_4(0, 가)는 마지막.
      await expect(idsFor({})).resolves.toEqual([
        'store_1',
        'store_3',
        'store_2',
        'store_4',
      ]);
    });

    it('uses storeId as the final tie-breaker when name and value tie', async () => {
      await expect(
        idsFor({
          sortBy: AdminStoreSortBy.ReservationCount,
          sortOrder: AdminSortOrder.Asc,
        }),
      ).resolves.toEqual(['store_4', 'store_2', 'store_3', 'store_1']);
    });

    it('puts null rates last regardless of direction', async () => {
      await expect(
        idsFor({
          sortBy: AdminStoreSortBy.NoShowRate,
          sortOrder: AdminSortOrder.Desc,
        }),
      ).resolves.toEqual(['store_1', 'store_2', 'store_4', 'store_3']);
      await expect(
        idsFor({
          sortBy: AdminStoreSortBy.NoShowRate,
          sortOrder: AdminSortOrder.Asc,
        }),
      ).resolves.toEqual(['store_2', 'store_1', 'store_4', 'store_3']);
    });

    it('sorts by businessName and createdAt (null createdAt last)', async () => {
      await expect(
        idsFor({
          sortBy: AdminStoreSortBy.BusinessName,
          sortOrder: AdminSortOrder.Asc,
        }),
      ).resolves.toEqual(['store_1', 'store_4', 'store_2', 'store_3']);
      await expect(
        idsFor({
          sortBy: AdminStoreSortBy.CreatedAt,
          sortOrder: AdminSortOrder.Desc,
        }),
      ).resolves.toEqual(['store_1', 'store_4', 'store_3', 'store_2']);
    });

    it('slices the sorted list by page/limit and keeps total as the filtered store count', async () => {
      const { service } = createService(sortingFixtures);

      const page2 = await service.listStores(listQuery({ page: 2, limit: 3 }));
      const beyond = await service.listStores(listQuery({ page: 9, limit: 3 }));

      expect(page2.items.map((item) => item.storeId)).toEqual(['store_4']);
      expect(page2).toMatchObject({ page: 2, limit: 3, total: 4 });
      expect(beyond.items).toEqual([]);
      expect(beyond.total).toBe(4);
      expect(beyond.meta.totals.reservationRevenue).toBe(700);
    });
  });

  describe('getStoreSummary', () => {
    it('returns the store, the echoed range and metrics from the same aggregation scoped to the store', async () => {
      const { service, prisma, adminStoreService } = createService({
        revenueRows: [{ store_id: 'store_a', _sum: { total_amount: 50000 } }],
        statusRows: [
          {
            store_id: 'store_a',
            status: reservations_status.completed,
            _count: { _all: 4 },
          },
        ],
        statuses: new Map([
          ['store_a', store_status_status.temporarily_closed],
        ]),
      });
      adminStoreService.getStoreOrThrow.mockResolvedValue(
        createStore('store_a', '홍대 짐보관소', {
          business_number: '123-45-67890',
          phone_number: '010-0000-0000',
        }),
      );

      const result = await service.getStoreSummary('store_a', {
        from: '2026-09-01',
        to: '2026-09-30',
      });

      expect(result.store).toMatchObject({
        id: 'store_a',
        businessName: '홍대 짐보관소',
        businessNumber: '123-45-67890',
        phoneNumber: '010-0000-0000',
        storeStatus: 'temporarily_closed',
      });
      expect(result.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
      expect(result.metrics).toMatchObject({
        reservationRevenue: 50000,
        reservationCount: 4,
        completedCount: 4,
        completionRate: 100,
        noShowRate: 0,
      });
      expect(adminStoreService.getLatestStatuses).toHaveBeenCalledWith([
        'store_a',
      ]);

      for (const call of [
        ...prisma.reservations.groupBy.mock.calls,
        ...prisma.payments.groupBy.mock.calls,
      ]) {
        expect(call[0].where.store_id).toEqual({ in: ['store_a'] });
        expect(call[0].by).not.toContain('locale');
      }
    });

    it('propagates STORE_NOT_FOUND from the store lookup', async () => {
      const { service, prisma, adminStoreService } = createService();
      adminStoreService.getStoreOrThrow.mockRejectedValue(
        new NotFoundException({ code: 'STORE_NOT_FOUND' }),
      );

      const promise = service.getStoreSummary('missing', {});

      await expect(promise).rejects.toThrow(NotFoundException);
      expect(prisma.reservations.groupBy).not.toHaveBeenCalled();
    });

    it('fills zeros and null rates for a store without reservations', async () => {
      const { service, adminStoreService } = createService();
      adminStoreService.getStoreOrThrow.mockResolvedValue(
        createStore('store_a', 'A'),
      );

      const result = await service.getStoreSummary('store_a', {});

      expect(result.metrics).toMatchObject({
        reservationRevenue: 0,
        reservationCount: 0,
        noShowRate: null,
      });
      expect(result.store.storeStatus).toBe('closed');
    });
  });
});
