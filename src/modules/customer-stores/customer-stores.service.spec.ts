import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerStoresService } from './customer-stores.service';

const createCustomerStoreRecord = () => ({
  id: 'store_1',
  slug: 'store-slug',
  business_name: '루라운지 혼술바',
  description: '매장 소개',
  phone_number: '01012345678',
  store_phone_number: '050700000000',
  address: '서울 용산구 한강대로44길 5',
  latitude: new Prisma.Decimal('37.52900000'),
  longitude: new Prisma.Decimal('126.96800000'),
  reviews: [
    {
      id: 'review_1',
      store_id: 'store_1',
      customer_id: 'customer_1',
      customer_name: '홍길동',
      reservation_id: null,
      storage_id: null,
      storage_number: null,
      type: 'store',
      rating: 5,
      comment: '좋아요',
      images: null,
      status: 'pending',
      response: null,
      response_date: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
  store_operating_hours: {
    id: 1,
    store_id: 'store_1',
    monday_open: null,
    monday_close: null,
    monday_operating: true,
    tuesday_open: null,
    tuesday_close: null,
    tuesday_operating: true,
    wednesday_open: null,
    wednesday_close: null,
    wednesday_operating: true,
    thursday_open: null,
    thursday_close: null,
    thursday_operating: true,
    friday_open: null,
    friday_close: null,
    friday_operating: true,
    saturday_open: null,
    saturday_close: null,
    saturday_operating: true,
    sunday_open: null,
    sunday_close: null,
    sunday_operating: false,
    holiday_notice: null,
    holiday_start_date: null,
    holiday_end_date: null,
    auto_schedule_enabled: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  },
  store_settings: {
    id: 1,
    store_id: 'store_1',
    store_photos: ['https://example.com/store.jpg'],
    total_slots: 20,
    daily_rate_threshold: 7,
    auto_approval: false,
    auto_overdue_notification: true,
    s_hourly_rate: 2000,
    s_daily_rate: 15000,
    s_hour_unit: 1,
    s_max_capacity: 5,
    s_enabled: true,
    m_hourly_rate: 3000,
    m_daily_rate: 24000,
    m_hour_unit: 1,
    m_max_capacity: 8,
    m_enabled: true,
    l_hourly_rate: 5000,
    l_daily_rate: 40000,
    l_hour_unit: 1,
    l_max_capacity: 3,
    l_enabled: true,
    xl_hourly_rate: 7000,
    xl_daily_rate: 55000,
    xl_hour_unit: 1,
    xl_max_capacity: 2,
    xl_enabled: true,
    special_hourly_rate: 10000,
    special_daily_rate: 70000,
    special_hour_unit: 1,
    special_max_capacity: 1,
    special_enabled: true,
    refrigeration_hourly_rate: 3000,
    refrigeration_daily_rate: 20000,
    refrigeration_hour_unit: 1,
    refrigeration_max_capacity: 3,
    refrigeration_enabled: false,
    new_reservation_notification: true,
    checkout_reminder_notification: true,
    overdue_notification: true,
    system_notification: true,
    categories: ['와인바'],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  },
});

const createService = () => {
  const prisma = {
    stores: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  return {
    service: new CustomerStoresService(prisma as never),
    prisma,
  };
};

describe('CustomerStoresService', () => {
  it('lists stores with keyword search and Express-compatible fields', async () => {
    const { service, prisma } = createService();

    prisma.stores.findMany.mockResolvedValue([createCustomerStoreRecord()]);

    const result = await service.listStores({
      limit: 150,
      keyword: ' 루라운지 ',
    });

    expect(prisma.stores.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { business_name: { contains: '루라운지' } },
            { address: { contains: '루라운지' } },
          ],
        },
        orderBy: { business_name: 'asc' },
        take: 100,
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: 'store_1',
      slug: 'store-slug',
      businessName: '루라운지 혼술바',
      phoneNumber: '050700000000',
      latitude: 37.529,
      longitude: 126.968,
      reviews: [
        expect.objectContaining({
          storeId: 'store_1',
          customerName: '홍길동',
        }) as Record<string, unknown>,
      ],
      settings: expect.objectContaining({
        storePhotos: ['https://example.com/store.jpg'],
        totalSlots: 20,
      }) as Record<string, unknown>,
    });
  });

  it('falls back to phone_number when store_phone_number is empty', async () => {
    const { service, prisma } = createService();

    prisma.stores.findMany.mockResolvedValue([
      {
        ...createCustomerStoreRecord(),
        store_phone_number: null,
      },
    ]);

    const result = await service.listStores({});

    expect(result.items[0]?.phoneNumber).toBe('01012345678');
  });

  it('gets a store detail by id or slug', async () => {
    const { service, prisma } = createService();

    prisma.stores.findFirst.mockResolvedValue(createCustomerStoreRecord());

    const result = await service.getStoreDetail('store-slug');

    expect(prisma.stores.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: 'store-slug' }, { slug: 'store-slug' }],
        },
      }),
    );
    expect(result.businessName).toBe('루라운지 혼술바');
  });

  it('throws NOT_FOUND when store detail does not exist', async () => {
    const { service, prisma } = createService();

    prisma.stores.findFirst.mockResolvedValue(null);

    await expect(
      service.getStoreDetail('missing-store'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
