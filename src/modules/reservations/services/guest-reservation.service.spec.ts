/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import {
  payments_status,
  reservations_payment_status,
  reservations_requested_storage_type,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { ReservationStorageService } from './reservation-storage.service';
import { GuestReservationService } from './guest-reservation.service';
import { ReservationPricingService } from '../pricing/reservation-pricing.service';

const createGuestReservationService = () => {
  const tx = {
    store_settings: {
      findUnique: jest.fn(),
    },
    reservations: {
      groupBy: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payments: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    storages: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    stores: {
      findFirst: jest.fn(),
    },
    store_settings: {
      findUnique: jest.fn(),
    },
    reservations: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const reservationStorageService = new ReservationStorageService(
    prisma as never,
  );

  const reservationPricingService = new ReservationPricingService();
  const mailService = {
    sendReservationCreatedEmail: jest.fn().mockResolvedValue(undefined),
  };
  const notificationsService = {
    sendCreateNotification: jest.fn().mockResolvedValue(undefined),
    sendCancelNotification: jest.fn().mockResolvedValue(undefined),
    sendPhotosNotification: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new GuestReservationService(
      prisma as never,
      reservationStorageService,
      reservationPricingService,
      mailService as never,
      notificationsService as never,
    ),
    prisma,
    tx,
    mailService,
    notificationsService,
  };
};

const guestStoreRow = {
  business_name: '테스트 매장',
  address: '서울',
  phone_number: '02-0000-0000',
  latitude: null,
  longitude: null,
};

describe('GuestReservationService', () => {
  it('does not resolve withdrawn stores when creating a reservation', async () => {
    const { service, prisma } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue(null);

    await expect(
      service.createReservation({
        storeId: 'store_withdrawn',
        customerName: '홍길동',
        phoneNumber: '010-1234-5678',
        startTime: '2026-04-27T10:00:00+09:00',
        duration: 4,
        bagCount: 1,
        requestedStorageType: reservations_requested_storage_type.s,
      }),
    ).rejects.toMatchObject({ response: { code: 'STORE_NOT_FOUND' } });
    expect(prisma.stores.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          closed_at: null,
          OR: [{ id: 'store_withdrawn' }, { slug: 'store_withdrawn' }],
        },
      }),
    );
  });

  it('creates a guest reservation with normalized phone and payment link', async () => {
    const { service, prisma, tx, mailService } =
      createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
    });
    prisma.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.s,
        _sum: { bag_count: 1 },
      },
    ]);
    tx.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
    });
    tx.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.s,
        _sum: { bag_count: 1 },
      },
    ]);
    tx.payments.findFirst.mockResolvedValue({
      id: 1n,
      status: payments_status.SUCCESS,
      reservation_id: null,
    });
    tx.payments.updateMany.mockResolvedValue({ count: 1 });
    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_1',
        store_id: 'store_1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        customer_email: 'guest@example.com',
        locale: 'en',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 2,
        total_amount: 9000,
        message: null,
        requested_storage_type: reservations_requested_storage_type.s,
        payment_status: reservations_payment_status.paid,
        qr_code: 'token',
        reservation_group_id: 'res_1',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    const result = await service.createReservation({
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '010-1234-5678',
      customerEmail: 'guest@example.com',
      locale: 'en',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 2,
      requestedStorageType: reservations_requested_storage_type.s,
      paymentKey: 'payment_key',
      orderId: 'order_id',
    });

    expect(tx.reservations.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          store_id: 'store_1',
          customer_phone: '01012345678',
          customer_email: 'guest@example.com',
          locale: 'en',
          total_amount: 9000,
          payment_status: reservations_payment_status.paid,
          payment_id: 1n,
          reservation_group_id: expect.stringMatching(/^res_/),
        }),
      ],
    });
    expect(tx.payments.updateMany).toHaveBeenCalledWith({
      where: { id: 1n, reservation_id: null },
      data: expect.objectContaining({
        reservation_id: expect.stringMatching(/^res_/),
      }),
    });
    expect(mailService.sendReservationCreatedEmail).toHaveBeenCalledWith(
      'guest@example.com',
      expect.objectContaining({
        reservationId: 'res_1',
        customerName: '홍길동',
        storeName: '테스트 매장',
        accessToken: 'token',
      }),
    );
    expect(result.storeName).toBe('테스트 매장');
    expect(result.reservation.accessToken).toBe('token');
    expect(result.reservation.locale).toBe('en');
    expect(result.reservation.groupId).toBe('res_1');
    expect(result.reservation.items).toEqual([
      {
        storageType: reservations_requested_storage_type.s,
        bagCount: 2,
        amount: 9000,
      },
    ]);
  });

  it('creates a guest reservation when phoneNumber is an email address', async () => {
    const { service, prisma, tx } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
    });
    tx.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
    });
    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_email',
        store_id: 'store_1',
        customer_name: 'Jane',
        customer_phone: 'guest@example.com',
        customer_email: 'guest@example.com',
        locale: 'ko',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 1,
        total_amount: 4500,
        message: null,
        requested_storage_type: reservations_requested_storage_type.s,
        payment_status: reservations_payment_status.pending,
        qr_code: 'token',
        reservation_group_id: 'res_email',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    await service.createReservation({
      storeId: 'store_1',
      customerName: 'Jane',
      phoneNumber: 'guest@example.com',
      email: 'guest@example.com',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 1,
      requestedStorageType: reservations_requested_storage_type.s,
    });

    expect(tx.reservations.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          customer_phone: 'guest@example.com',
          customer_email: 'guest@example.com',
          locale: 'ko',
        }),
      ],
    });
  });

  it('creates a guest reservation when the email is longer than 20 characters', async () => {
    const { service, prisma, tx } = createGuestReservationService();
    const longEmail = 'long.email.reservation.guest@example.com';

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
    });
    tx.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
    });
    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_long_email',
        store_id: 'store_1',
        customer_name: 'Jane',
        customer_phone: longEmail,
        customer_email: longEmail,
        locale: 'ko',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 1,
        total_amount: 4500,
        message: null,
        requested_storage_type: reservations_requested_storage_type.s,
        payment_status: reservations_payment_status.pending,
        qr_code: 'token',
        reservation_group_id: 'res_long_email',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    await service.createReservation({
      storeId: 'store_1',
      customerName: 'Jane',
      phoneNumber: longEmail,
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 1,
      requestedStorageType: reservations_requested_storage_type.s,
    });

    expect(tx.reservations.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          customer_phone: longEmail,
          customer_email: longEmail,
        }),
      ],
    });
    const createdRow = tx.reservations.createMany.mock.calls[0][0].data[0];
    expect(createdRow.customer_id.length).toBeLessThanOrEqual(255);
  });

  it('rejects an email longer than 254 characters', async () => {
    const { service } = createGuestReservationService();
    const overlongEmail = `${'a'.repeat(250)}@example.com`;

    await expect(
      service.createReservation({
        storeId: 'store_1',
        customerName: 'Jane',
        phoneNumber: overlongEmail,
        startTime: '2026-04-27T10:00:00+09:00',
        duration: 4,
        bagCount: 1,
        requestedStorageType: reservations_requested_storage_type.s,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
      }),
    });
  });

  it('creates one reservation row per storage type for multi-type requests', async () => {
    const { service, prisma, tx, mailService } =
      createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
      m_enabled: true,
      l_max_capacity: 5,
      l_enabled: true,
      xl_max_capacity: 5,
      xl_enabled: true,
    });
    tx.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
      m_enabled: true,
      l_max_capacity: 5,
      l_enabled: true,
      xl_max_capacity: 5,
      xl_enabled: true,
    });
    tx.payments.findFirst.mockResolvedValue({
      id: 1n,
      status: payments_status.SUCCESS,
      reservation_id: null,
    });
    tx.payments.updateMany.mockResolvedValue({ count: 1 });
    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_a',
        store_id: 'store_1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        customer_email: 'guest@example.com',
        locale: 'ko',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 2,
        total_amount: 9000,
        message: null,
        requested_storage_type: reservations_requested_storage_type.s,
        payment_status: reservations_payment_status.paid,
        qr_code: 'token',
        reservation_group_id: 'res_a',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
      {
        id: 'res_b',
        store_id: 'store_1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        customer_email: 'guest@example.com',
        locale: 'ko',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 1,
        total_amount: 8000,
        message: null,
        requested_storage_type: reservations_requested_storage_type.l,
        payment_status: reservations_payment_status.paid,
        qr_code: 'token',
        reservation_group_id: 'res_a',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    const result = await service.createReservation({
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '010-1234-5678',
      customerEmail: 'guest@example.com',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      items: [
        { storageType: reservations_requested_storage_type.s, bagCount: 2 },
        { storageType: reservations_requested_storage_type.l, bagCount: 1 },
      ],
      paymentKey: 'payment_key',
      orderId: 'order_id',
    });

    const createManyArg = tx.reservations.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };

    expect(createManyArg.data).toHaveLength(2);
    expect(createManyArg.data[0]).toMatchObject({
      requested_storage_type: reservations_requested_storage_type.s,
      bag_count: 2,
      total_amount: 9000,
      payment_id: 1n,
      payment_status: reservations_payment_status.paid,
    });
    expect(createManyArg.data[1]).toMatchObject({
      requested_storage_type: reservations_requested_storage_type.l,
      bag_count: 1,
      total_amount: 8000,
      payment_id: null,
      payment_status: reservations_payment_status.paid,
    });
    // 그룹 공유 값: group_id는 대표 예약 id, 토큰/고객/생성시각 동일
    expect(createManyArg.data[0].reservation_group_id).toBe(
      createManyArg.data[0].id,
    );
    expect(createManyArg.data[1].reservation_group_id).toBe(
      createManyArg.data[0].id,
    );
    expect(createManyArg.data[1].qr_code).toBe(createManyArg.data[0].qr_code);
    expect(createManyArg.data[1].customer_id).toBe(
      createManyArg.data[0].customer_id,
    );
    expect(createManyArg.data[1].created_at).toBe(
      createManyArg.data[0].created_at,
    );

    expect(result.reservation.id).toBe('res_a');
    expect(result.reservation.groupId).toBe('res_a');
    expect(result.reservation.bagCount).toBe(3);
    expect(result.reservation.totalAmount).toBe(17000);
    expect(result.reservation.items).toEqual([
      {
        storageType: reservations_requested_storage_type.s,
        bagCount: 2,
        amount: 9000,
      },
      {
        storageType: reservations_requested_storage_type.l,
        bagCount: 1,
        amount: 8000,
      },
    ]);
    expect(mailService.sendReservationCreatedEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendReservationCreatedEmail).toHaveBeenCalledWith(
      'guest@example.com',
      expect.objectContaining({
        reservationId: 'res_a',
        bagCount: 3,
        totalAmount: 17000,
      }),
    );
  });

  it('rejects the whole group when one storage type lacks capacity', async () => {
    const { service, prisma, tx } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      m_max_capacity: 5,
      m_enabled: true,
      l_max_capacity: 5,
      l_enabled: true,
      xl_max_capacity: 5,
      xl_enabled: true,
    });
    prisma.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.l,
        _sum: { bag_count: 5 },
      },
    ]);

    await expect(
      service.createReservation({
        storeId: 'store_1',
        customerName: '홍길동',
        phoneNumber: '010-1234-5678',
        startTime: '2026-04-27T10:00:00+09:00',
        duration: 4,
        items: [
          { storageType: reservations_requested_storage_type.s, bagCount: 2 },
          { storageType: reservations_requested_storage_type.l, bagCount: 1 },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CAPACITY_EXCEEDED',
        details: expect.objectContaining({
          failures: [
            expect.objectContaining({
              storageType: reservations_requested_storage_type.l,
              requested: 1,
            }),
          ],
        }),
      }),
    });
    expect(tx.reservations.createMany).not.toHaveBeenCalled();
  });

  it('merges duplicate storage types after normalization (xl/special → l)', async () => {
    const { service, prisma, tx } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      xl_max_capacity: 10,
    });
    tx.store_settings.findUnique.mockResolvedValue({
      xl_max_capacity: 10,
    });
    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_l',
        store_id: 'store_1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        customer_email: null,
        locale: 'ko',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 5,
        total_amount: 40000,
        message: null,
        requested_storage_type: reservations_requested_storage_type.l,
        payment_status: reservations_payment_status.pending,
        qr_code: 'token',
        reservation_group_id: 'res_l',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    await service.createReservation({
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '010-1234-5678',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      items: [
        { storageType: reservations_requested_storage_type.xl, bagCount: 2 },
        {
          storageType: reservations_requested_storage_type.special,
          bagCount: 3,
        },
      ],
    });

    const createManyArg = tx.reservations.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };

    expect(createManyArg.data).toHaveLength(1);
    expect(createManyArg.data[0]).toMatchObject({
      requested_storage_type: reservations_requested_storage_type.l,
      bag_count: 5,
    });
  });

  it('rejects when merged bag count per type exceeds 10', async () => {
    const { service } = createGuestReservationService();

    await expect(
      service.createReservation({
        storeId: 'store_1',
        customerName: '홍길동',
        phoneNumber: '010-1234-5678',
        startTime: '2026-04-27T10:00:00+09:00',
        duration: 4,
        items: [
          { storageType: reservations_requested_storage_type.xl, bagCount: 6 },
          {
            storageType: reservations_requested_storage_type.special,
            bagCount: 5,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          storageType: reservations_requested_storage_type.l,
          merged: 11,
        }),
      }),
    });
  });

  it('prefers items over legacy single-type fields when both are sent', async () => {
    const { service, prisma, tx } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({
      l_max_capacity: 5,
    });
    tx.store_settings.findUnique.mockResolvedValue({
      l_max_capacity: 5,
    });
    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_m',
        store_id: 'store_1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        customer_email: null,
        locale: 'ko',
        status: reservations_status.pending,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 1,
        total_amount: 6000,
        message: null,
        requested_storage_type: reservations_requested_storage_type.m,
        payment_status: reservations_payment_status.pending,
        qr_code: 'token',
        reservation_group_id: 'res_m',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    await service.createReservation({
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '010-1234-5678',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 9,
      storageType: reservations_requested_storage_type.s,
      items: [
        { storageType: reservations_requested_storage_type.m, bagCount: 1 },
      ],
    });

    const createManyArg = tx.reservations.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };

    expect(createManyArg.data).toHaveLength(1);
    expect(createManyArg.data[0]).toMatchObject({
      requested_storage_type: reservations_requested_storage_type.m,
      bag_count: 1,
    });
  });

  it('lists guest reservations by email', async () => {
    const { service, prisma } = createGuestReservationService();

    prisma.reservations.findMany.mockResolvedValue([
      {
        id: 'res_email',
        store_id: 'store_1',
        customer_name: 'Jane',
        customer_phone: 'guest@example.com',
        customer_email: 'guest@example.com',
        locale: 'ko',
        status: reservations_status.confirmed,
        start_time: new Date('2026-04-27T01:00:00.000Z'),
        end_time: new Date('2026-04-27T05:00:00.000Z'),
        duration: 4,
        bag_count: 1,
        total_amount: 4500,
        message: null,
        requested_storage_type: reservations_requested_storage_type.s,
        payment_status: reservations_payment_status.pending,
        qr_code: 'token',
        reservation_group_id: null,
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        stores: guestStoreRow,
      },
    ]);

    const result = await service.listReservations({
      email: 'Guest@Example.com',
    });

    expect(prisma.reservations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { customer_email: 'guest@example.com' },
            { customer_phone: 'guest@example.com' },
          ],
        },
      }),
    );
    expect(result.total).toBe(1);
  });

  it('merges grouped rows into one list entry and keeps legacy rows as-is', async () => {
    const { service, prisma } = createGuestReservationService();
    const base = {
      store_id: 'store_1',
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: null,
      locale: 'ko',
      start_time: new Date('2026-04-27T01:00:00.000Z'),
      end_time: new Date('2026-04-27T05:00:00.000Z'),
      duration: 4,
      message: null,
      payment_status: reservations_payment_status.pending,
      qr_code: 'token',
      stores: guestStoreRow,
    };

    prisma.reservations.findMany.mockResolvedValue([
      {
        ...base,
        id: 'res_a',
        status: reservations_status.confirmed,
        bag_count: 2,
        total_amount: 9000,
        requested_storage_type: reservations_requested_storage_type.s,
        reservation_group_id: 'res_a',
        created_at: new Date('2026-04-28T00:00:00.000Z'),
      },
      {
        ...base,
        id: 'res_b',
        status: reservations_status.pending,
        bag_count: 1,
        total_amount: 8000,
        requested_storage_type: reservations_requested_storage_type.l,
        reservation_group_id: 'res_a',
        created_at: new Date('2026-04-28T00:00:00.000Z'),
      },
      {
        ...base,
        id: 'res_legacy',
        status: reservations_status.completed,
        bag_count: 1,
        total_amount: 4500,
        requested_storage_type: reservations_requested_storage_type.s,
        reservation_group_id: null,
        created_at: new Date('2026-04-27T00:00:00.000Z'),
      },
    ]);

    const result = await service.listReservations({
      phoneNumber: '010-1234-5678',
    });

    expect(result.total).toBe(2);
    expect(result.items[0].id).toBe('res_a');
    expect(result.items[0].bagCount).toBe(3);
    expect(result.items[0].totalAmount).toBe(17000);
    expect(result.items[0].items).toHaveLength(2);
    // 그룹 status는 진행도가 가장 낮은 상태(pending)로 노출
    expect(result.items[0].status).toBe(reservations_status.pending);
    expect(result.items[1].id).toBe('res_legacy');
    expect(result.items[1].items).toHaveLength(1);
    // accessToken(qr_code)은 완료 예약에만 포함 — 랜딩 예약 내역의 리뷰 버튼용.
    // 활성 예약은 목록(전화번호 조회)에서 토큰 미노출 유지.
    expect(result.items[0].accessToken).toBeUndefined();
    expect(result.items[1].accessToken).toBe('token');
  });

  it('returns the merged group when fetched by a non-representative member id', async () => {
    const { service, prisma } = createGuestReservationService();
    const base = {
      store_id: 'store_1',
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: null,
      locale: 'ko',
      status: reservations_status.pending,
      start_time: new Date('2026-04-27T01:00:00.000Z'),
      end_time: new Date('2026-04-27T05:00:00.000Z'),
      duration: 4,
      message: null,
      payment_status: reservations_payment_status.pending,
      qr_code: 'token',
      created_at: new Date('2026-04-27T00:00:00.000Z'),
      stores: guestStoreRow,
    };
    const memberRow = {
      ...base,
      id: 'res_b',
      bag_count: 1,
      total_amount: 8000,
      requested_storage_type: reservations_requested_storage_type.l,
      reservation_group_id: 'res_a',
    };

    prisma.reservations.findFirst.mockResolvedValue(memberRow);
    prisma.reservations.findMany.mockResolvedValue([
      {
        ...base,
        id: 'res_a',
        bag_count: 2,
        total_amount: 9000,
        requested_storage_type: reservations_requested_storage_type.s,
        reservation_group_id: 'res_a',
      },
      memberRow,
    ]);

    const result = await service.getReservation('res_b', { token: 'token' });

    expect(prisma.reservations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reservation_group_id: 'res_a', qr_code: 'token' },
      }),
    );
    expect(result.id).toBe('res_a');
    expect(result.groupId).toBe('res_a');
    expect(result.bagCount).toBe(3);
    expect(result.totalAmount).toBe(17000);
    expect(result.items).toHaveLength(2);
  });

  it('cancels a guest reservation after email verification', async () => {
    const { service, tx } = createGuestReservationService();
    const future = new Date(Date.now() + 60 * 60 * 1000);

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_email',
      customer_phone: 'guest@example.com',
      customer_email: 'guest@example.com',
      status: reservations_status.confirmed,
      start_time: future,
      storage_id: null,
      reservation_group_id: null,
    });

    const result = await service.cancelReservation('res_email', {
      email: 'guest@example.com',
    });

    expect(tx.reservations.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['res_email'] } },
      data: expect.objectContaining({
        status: reservations_status.cancelled,
      }),
    });
    expect(result).toEqual({
      id: 'res_email',
      status: reservations_status.cancelled,
      groupId: 'res_email',
      cancelledCount: 1,
    });
  });

  it('cancels a guest reservation only after phone verification and releases storage', async () => {
    const { service, prisma, tx } = createGuestReservationService();
    const future = new Date(Date.now() + 60 * 60 * 1000);

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_1',
      customer_phone: '01012345678',
      status: reservations_status.confirmed,
      start_time: future,
      storage_id: 'storage_1',
      reservation_group_id: null,
    });

    const result = await service.cancelReservation('res_1', {
      phoneNumber: '010-1234-5678',
    });

    expect(tx.reservations.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['res_1'] } },
      data: expect.objectContaining({
        status: reservations_status.cancelled,
      }),
    });
    expect(tx.storages.update).toHaveBeenCalledWith({
      where: { id: 'storage_1' },
      data: expect.objectContaining({
        status: storages_status.available,
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'res_1',
      status: reservations_status.cancelled,
      groupId: 'res_1',
      cancelledCount: 1,
    });
  });

  it('cancels all reservations in a group when called with a member id', async () => {
    const { service, tx } = createGuestReservationService();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const groupRows = [
      {
        id: 'res_a',
        customer_phone: '01012345678',
        customer_email: null,
        status: reservations_status.confirmed,
        start_time: future,
        storage_id: 'storage_1',
        reservation_group_id: 'res_a',
        requested_storage_type: reservations_requested_storage_type.s,
      },
      {
        id: 'res_b',
        customer_phone: '01012345678',
        customer_email: null,
        status: reservations_status.pending,
        start_time: future,
        storage_id: 'storage_2',
        reservation_group_id: 'res_a',
        requested_storage_type: reservations_requested_storage_type.l,
      },
    ];

    tx.reservations.findFirst.mockResolvedValue(groupRows[1]);
    tx.reservations.findMany.mockResolvedValue(groupRows);

    const result = await service.cancelReservation('res_b', {
      phoneNumber: '010-1234-5678',
    });

    expect(tx.reservations.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['res_a', 'res_b'] } },
      data: expect.objectContaining({
        status: reservations_status.cancelled,
      }),
    });
    expect(tx.storages.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      id: 'res_a',
      status: reservations_status.cancelled,
      groupId: 'res_a',
      cancelledCount: 2,
    });
  });

  it('rejects group cancellation when any member is not cancellable', async () => {
    const { service, tx } = createGuestReservationService();
    const future = new Date(Date.now() + 60 * 60 * 1000);

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_a',
      customer_phone: '01012345678',
      customer_email: null,
      status: reservations_status.confirmed,
      start_time: future,
      storage_id: null,
      reservation_group_id: 'res_a',
      requested_storage_type: reservations_requested_storage_type.s,
    });
    tx.reservations.findMany.mockResolvedValue([
      {
        id: 'res_a',
        customer_phone: '01012345678',
        customer_email: null,
        status: reservations_status.confirmed,
        start_time: future,
        storage_id: null,
        reservation_group_id: 'res_a',
        requested_storage_type: reservations_requested_storage_type.s,
      },
      {
        id: 'res_b',
        customer_phone: '01012345678',
        customer_email: null,
        status: reservations_status.in_progress,
        start_time: future,
        storage_id: 'storage_2',
        reservation_group_id: 'res_a',
        requested_storage_type: reservations_requested_storage_type.l,
      },
    ]);

    await expect(
      service.cancelReservation('res_a', { phoneNumber: '010-1234-5678' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'NOT_CANCELLABLE',
        details: expect.objectContaining({
          blockedItems: [
            expect.objectContaining({
              id: 'res_b',
              status: reservations_status.in_progress,
            }),
          ],
        }),
      }),
    });
    expect(tx.reservations.updateMany).not.toHaveBeenCalled();
  });

  it('auto-approves the group on creation and assigns storage', async () => {
    const { service, prisma, tx } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue({ m_max_capacity: 5 });
    tx.store_settings.findUnique.mockResolvedValue({ m_max_capacity: 5 });

    const pendingRow = {
      id: 'res_1',
      store_id: 'store_1',
      status: reservations_status.pending,
      start_time: new Date('2026-04-27T01:00:00.000Z'),
      end_time: new Date('2026-04-27T05:00:00.000Z'),
      requested_storage_type: reservations_requested_storage_type.s,
      confirmed_at: null,
    };
    // autoApproveGroup: 그룹의 pending 행을 조회한 뒤 보관함을 할당한다.
    tx.reservations.findMany.mockResolvedValue([pendingRow]);
    tx.storages.findFirst.mockResolvedValue({ id: 'storage_1', number: 'S1' });
    // 응답용 그룹 조회는 prisma.reservations.findMany를 사용한다.
    prisma.reservations.findMany.mockResolvedValue([
      {
        ...pendingRow,
        customer_name: '홍길동',
        customer_phone: '01012345678',
        customer_email: null,
        locale: 'ko',
        duration: 4,
        bag_count: 1,
        total_amount: 4500,
        message: null,
        payment_status: reservations_payment_status.pending,
        qr_code: 'token',
        reservation_group_id: 'res_1',
        created_at: new Date('2026-04-27T00:00:00.000Z'),
        status: reservations_status.confirmed,
        storage_id: 'storage_1',
        storage_number: 'S1',
        stores: guestStoreRow,
      },
    ]);

    await service.createReservation({
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '010-1234-5678',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 1,
      requestedStorageType: reservations_requested_storage_type.s,
    });

    expect(tx.reservations.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: expect.objectContaining({
        status: reservations_status.confirmed,
        storage_id: 'storage_1',
        storage_number: 'S1',
      }),
    });
  });

  it('cleanup cancels expired unpaid reservations (incl. auto-approved) and releases storage', async () => {
    const { service, tx } = createGuestReservationService();

    tx.reservations.findMany.mockResolvedValue([
      { id: 'res_1', storage_id: 'storage_1' },
      { id: 'res_2', storage_id: null },
    ]);
    tx.reservations.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.cleanupExpiredReservations();

    expect(tx.storages.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['storage_1'] } },
      data: expect.objectContaining({ status: storages_status.available }),
    });
    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['res_1', 'res_2'] },
          status: expect.objectContaining({
            in: expect.arrayContaining([
              reservations_status.pending,
              reservations_status.confirmed,
            ]),
          }),
          payment_status: reservations_payment_status.pending,
        }),
        data: expect.objectContaining({
          status: reservations_status.cancelled,
        }),
      }),
    );
    expect(result).toEqual({ cancelledCount: 2, ttlMinutes: 30 });
  });

  describe('calculateTotalAmount (progressive pricing)', () => {
    const pricingService = new ReservationPricingService();

    it('charges 1-day 소형 rate when pickup is on the same KST date', () => {
      const start = new Date('2026-05-01T01:00:00.000Z');
      const end = new Date('2026-05-01T05:00:00.000Z');
      expect(
        pricingService.calculateTotalAmount({
          storageType: reservations_requested_storage_type.s,
          bagCount: 1,
          startTime: start,
          endTime: end,
        }),
      ).toBe(4500);
      expect(
        pricingService.calculateTotalAmount({
          storageType: reservations_requested_storage_type.s,
          bagCount: 3,
          startTime: start,
          endTime: end,
        }),
      ).toBe(13500);
    });

    it('charges 2-day rate when pickup is on the next KST date', () => {
      const start = new Date('2026-05-01T01:00:00.000Z');
      const end = new Date('2026-05-02T01:00:00.000Z');
      expect(
        pricingService.calculateTotalAmount({
          storageType: reservations_requested_storage_type.s,
          bagCount: 1,
          startTime: start,
          endTime: end,
        }),
      ).toBe(9000);
      expect(
        pricingService.calculateTotalAmount({
          storageType: reservations_requested_storage_type.m,
          bagCount: 1,
          startTime: start,
          endTime: end,
        }),
      ).toBe(12000);
    });

    it('charges (N+1)-day rate when pickup is N KST days later', () => {
      const start = new Date('2026-05-01T01:00:00.000Z');
      const end = new Date('2026-05-04T01:00:00.000Z');
      expect(
        pricingService.calculateTotalAmount({
          storageType: reservations_requested_storage_type.l,
          bagCount: 1,
          startTime: start,
          endTime: end,
        }),
      ).toBe(32000);
    });

    it('treats close-to-midnight pickup within same KST day as 1-day rate', () => {
      const start = new Date('2026-05-01T01:00:00.000Z');
      const end = new Date('2026-05-01T14:59:00.000Z');
      expect(
        pricingService.calculateTotalAmount({
          storageType: reservations_requested_storage_type.s,
          bagCount: 1,
          startTime: start,
          endTime: end,
        }),
      ).toBe(4500);
    });
  });
});

describe('GuestReservationService 판매 규격 (소·중·대 3종)', () => {
  const availabilityQuery = {
    storeId: 'store_1',
    startTime: '2026-05-01T01:00:00.000Z',
    duration: 4,
  };

  /** 소·중·대가 모두 켜져 있는 정상 매장 (컬럼은 한 칸 밀린 레거시 오프셋) */
  const enabledSettings = {
    m_max_capacity: 8,
    m_enabled: true,
    l_max_capacity: 5,
    l_enabled: true,
    xl_max_capacity: 3,
    xl_enabled: true,
    refrigeration_max_capacity: 3,
    refrigeration_enabled: false,
  };

  it('소·중·대 3종만 응답하고 특대·특수·냉장은 팔지 않는다', async () => {
    const { service, prisma } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({ id: 'store_1' });
    prisma.store_settings.findUnique.mockResolvedValue(enabledSettings);

    const result = await service.getAvailability(availabilityQuery);

    expect(Object.keys(result.items).sort()).toEqual(['l', 'm', 's']);
  });

  it('점주가 끈 규격은 잔여 0으로 내려 예약을 받지 않는다', async () => {
    const { service, prisma } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({ id: 'store_1' });
    prisma.store_settings.findUnique.mockResolvedValue({
      ...enabledSettings,
      xl_enabled: false, // 화면상 '대형' 비활성
    });

    const result = await service.getAvailability(availabilityQuery);

    expect(result.items.l).toEqual({
      maxCapacity: 0,
      currentCount: 0,
      remaining: 0,
    });
    expect(result.items.s.remaining).toBe(8);
  });

  it('레거시 특대(xl) 예약도 대형 잔여에서 차감한다', async () => {
    const { service, prisma } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({ id: 'store_1' });
    prisma.store_settings.findUnique.mockResolvedValue(enabledSettings);
    prisma.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.l,
        _sum: { bag_count: 1 },
      },
      {
        requested_storage_type: reservations_requested_storage_type.xl,
        _sum: { bag_count: 2 },
      },
    ]);

    const result = await service.getAvailability(availabilityQuery);

    // 대형 정원 3 - (l 1건 + xl 2건) = 0
    expect(result.items.l.currentCount).toBe(3);
    expect(result.items.l.remaining).toBe(0);
  });

  it('냉장 예약은 정원 0이라 접수 단계에서 막힌다', async () => {
    const { service, prisma, tx } = createGuestReservationService();

    prisma.stores.findFirst.mockResolvedValue({ id: 'store_1' });
    prisma.store_settings.findUnique.mockResolvedValue(enabledSettings);
    tx.store_settings.findUnique.mockResolvedValue(enabledSettings);

    await expect(
      service.createReservation({
        storeId: 'store_1',
        customerName: '홍길동',
        phoneNumber: '010-1234-5678',
        startTime: '2026-05-01T01:00:00.000Z',
        duration: 4,
        bagCount: 1,
        storageType: reservations_requested_storage_type.refrigeration,
      }),
    ).rejects.toMatchObject({
      response: { code: 'CAPACITY_EXCEEDED' },
    });
  });
});

describe('GuestReservationService 멀티타입 3종 동시 (소·중·대)', () => {
  /** 소·중·대가 모두 켜진 매장 — 컬럼은 한 칸 밀린 레거시 오프셋 (소형→m_*, 중형→l_*, 대형→xl_*) */
  const fullSettings = {
    m_max_capacity: 8,
    m_enabled: true,
    l_max_capacity: 5,
    l_enabled: true,
    xl_max_capacity: 3,
    xl_enabled: true,
  };

  const createRequest = {
    storeId: 'store_1',
    customerName: '홍길동',
    phoneNumber: '010-1234-5678',
    startTime: '2026-05-01T01:00:00.000Z',
    duration: 4,
    items: [
      { storageType: reservations_requested_storage_type.s, bagCount: 2 },
      { storageType: reservations_requested_storage_type.m, bagCount: 1 },
      { storageType: reservations_requested_storage_type.l, bagCount: 1 },
    ],
  };

  const pendingRow = (
    id: string,
    storageType: reservations_requested_storage_type,
  ) => ({
    id,
    store_id: 'store_1',
    status: reservations_status.pending,
    start_time: new Date('2026-05-01T01:00:00.000Z'),
    end_time: new Date('2026-05-01T05:00:00.000Z'),
    requested_storage_type: storageType,
    confirmed_at: null,
  });

  const groupRow = (overrides: Record<string, unknown>) => ({
    id: 'res_a',
    store_id: 'store_1',
    customer_name: '홍길동',
    customer_phone: '01012345678',
    customer_email: null,
    locale: 'ko',
    status: reservations_status.confirmed,
    start_time: new Date('2026-05-01T01:00:00.000Z'),
    end_time: new Date('2026-05-01T05:00:00.000Z'),
    duration: 4,
    bag_count: 1,
    total_amount: 0,
    message: null,
    requested_storage_type: reservations_requested_storage_type.s,
    payment_status: reservations_payment_status.pending,
    qr_code: 'token',
    reservation_group_id: 'res_a',
    created_at: new Date('2026-05-01T00:00:00.000Z'),
    stores: guestStoreRow,
    ...overrides,
  });

  const setupThreeTypeStore = () => {
    const context = createGuestReservationService();
    const { prisma, tx } = context;

    prisma.stores.findFirst.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.store_settings.findUnique.mockResolvedValue(fullSettings);
    tx.store_settings.findUnique.mockResolvedValue(fullSettings);
    prisma.reservations.findMany.mockResolvedValue([
      groupRow({
        id: 'res_a',
        bag_count: 2,
        total_amount: 9000,
        requested_storage_type: reservations_requested_storage_type.s,
      }),
      groupRow({
        id: 'res_b',
        bag_count: 1,
        total_amount: 6000,
        requested_storage_type: reservations_requested_storage_type.m,
      }),
      groupRow({
        id: 'res_c',
        bag_count: 1,
        total_amount: 8000,
        requested_storage_type: reservations_requested_storage_type.l,
      }),
    ]);

    return context;
  };

  it('소·중·대 3종을 한 번에 예약하면 행 3개가 같은 그룹으로 생성되고 전부 배정된다', async () => {
    const { service, tx } = setupThreeTypeStore();

    tx.reservations.findMany.mockResolvedValue([
      pendingRow('res_a', reservations_requested_storage_type.s),
      pendingRow('res_b', reservations_requested_storage_type.m),
      pendingRow('res_c', reservations_requested_storage_type.l),
    ]);
    tx.storages.findFirst
      .mockResolvedValueOnce({ id: 'storage_s1', number: 'S1' })
      .mockResolvedValueOnce({ id: 'storage_m1', number: 'M1' })
      .mockResolvedValueOnce({ id: 'storage_l1', number: 'L1' });

    const result = await service.createReservation(createRequest);

    const createManyArg = tx.reservations.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(createManyArg.data).toHaveLength(3);
    expect(createManyArg.data.map((row) => row.requested_storage_type)).toEqual(
      [
        reservations_requested_storage_type.s,
        reservations_requested_storage_type.m,
        reservations_requested_storage_type.l,
      ],
    );
    expect(createManyArg.data.map((row) => row.total_amount)).toEqual([
      9000, 6000, 8000,
    ]);
    expect(createManyArg.data[0].reservation_group_id).toBe(
      createManyArg.data[0].id,
    );
    expect(
      new Set(createManyArg.data.map((row) => row.reservation_group_id)).size,
    ).toBe(1);

    expect(tx.reservations.update).toHaveBeenCalledTimes(3);
    expect(tx.reservations.update).toHaveBeenCalledWith({
      where: { id: 'res_c' },
      data: expect.objectContaining({
        status: reservations_status.confirmed,
        storage_id: 'storage_l1',
        storage_number: 'L1',
      }),
    });

    expect(result.reservation.bagCount).toBe(4);
    expect(result.reservation.totalAmount).toBe(23000);
    expect(result.reservation.items).toHaveLength(3);
  });

  it('한 규격만 정원이 차도 그룹 전체가 거부되고 행이 만들어지지 않는다', async () => {
    const { service, prisma, tx } = setupThreeTypeStore();

    // 대형 정원(xl_max_capacity) 3이 이미 소진된 상태
    prisma.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.l,
        _sum: { bag_count: 3 },
      },
    ]);

    await expect(
      service.createReservation(createRequest),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CAPACITY_EXCEEDED',
        details: expect.objectContaining({
          storageType: reservations_requested_storage_type.l,
          failedTypes: [reservations_requested_storage_type.l],
          failures: [
            expect.objectContaining({
              storageType: reservations_requested_storage_type.l,
              maxCapacity: 3,
              currentCount: 3,
              requested: 1,
            }),
          ],
        }),
      }),
    });
    expect(tx.reservations.createMany).not.toHaveBeenCalled();
  });

  it('두 규격이 동시에 부족하면 failedTypes에 둘 다 담긴다', async () => {
    const { service, prisma } = setupThreeTypeStore();

    prisma.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.s,
        _sum: { bag_count: 8 },
      },
      {
        requested_storage_type: reservations_requested_storage_type.l,
        _sum: { bag_count: 3 },
      },
    ]);

    await expect(
      service.createReservation(createRequest),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CAPACITY_EXCEEDED',
        details: expect.objectContaining({
          storageType: reservations_requested_storage_type.s,
          failedTypes: [
            reservations_requested_storage_type.s,
            reservations_requested_storage_type.l,
          ],
        }),
      }),
    });
  });

  it('레거시 특대(xl) 잔존 예약이 대형 정원을 차지하면 대형 포함 요청만 거부된다', async () => {
    const { service, prisma } = setupThreeTypeStore();

    // 대형 정원 3 = l 1건 + xl 2건 → 소·중은 통과, 대형만 실패
    prisma.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.l,
        _sum: { bag_count: 1 },
      },
      {
        requested_storage_type: reservations_requested_storage_type.xl,
        _sum: { bag_count: 2 },
      },
    ]);

    await expect(
      service.createReservation(createRequest),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CAPACITY_EXCEEDED',
        details: expect.objectContaining({
          failedTypes: [reservations_requested_storage_type.l],
        }),
      }),
    });
  });

  it('트랜잭션 안의 2차 용량 체크가 동시 예약 경쟁을 잡는다', async () => {
    const { service, tx } = setupThreeTypeStore();

    // 1차(트랜잭션 밖)는 통과했지만 그 사이 대형이 소진된 상태
    tx.reservations.groupBy.mockResolvedValue([
      {
        requested_storage_type: reservations_requested_storage_type.l,
        _sum: { bag_count: 3 },
      },
    ]);

    await expect(
      service.createReservation(createRequest),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CAPACITY_EXCEEDED' }),
    });
    expect(tx.reservations.createMany).not.toHaveBeenCalled();
  });

  it('대형 보관함만 없으면 대형 행만 접수 대기로 남고 나머지는 확정된다', async () => {
    const { service, tx } = setupThreeTypeStore();

    tx.reservations.findMany.mockResolvedValue([
      pendingRow('res_a', reservations_requested_storage_type.s),
      pendingRow('res_b', reservations_requested_storage_type.m),
      pendingRow('res_c', reservations_requested_storage_type.l),
    ]);
    tx.storages.findFirst
      .mockResolvedValueOnce({ id: 'storage_s1', number: 'S1' })
      .mockResolvedValueOnce({ id: 'storage_m1', number: 'M1' })
      .mockResolvedValueOnce(null);

    await service.createReservation(createRequest);

    expect(tx.reservations.update).toHaveBeenCalledTimes(2);
    const updatedIds = (
      tx.reservations.update.mock.calls as Array<[{ where: { id: string } }]>
    ).map((call) => call[0].where.id);
    expect(updatedIds).toEqual(['res_a', 'res_b']);
  });

  it('enabled가 NULL인 규격은 켜진 것으로 보고 판매한다 (스키마 기본값과 동일)', async () => {
    const { service, prisma, tx } = setupThreeTypeStore();

    const nullEnabledSettings = { ...fullSettings, xl_enabled: null };
    prisma.store_settings.findUnique.mockResolvedValue(nullEnabledSettings);
    tx.store_settings.findUnique.mockResolvedValue(nullEnabledSettings);

    await service.createReservation(createRequest);

    const createManyArg = tx.reservations.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(createManyArg.data).toHaveLength(3);
  });

  it('생성·자동승인 트랜잭션에 여유 타임아웃을 준다', async () => {
    const { service, prisma } = setupThreeTypeStore();

    await service.createReservation(createRequest);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    for (const call of prisma.$transaction.mock.calls as Array<
      [unknown, { timeout: number }]
    >) {
      expect(call[1]).toEqual({ timeout: 15_000 });
    }
  });
});
