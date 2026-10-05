/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  reservations_requested_storage_type,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { ReservationCommandService } from './reservation-command.service';
import { ReservationPricingService } from '../pricing/reservation-pricing.service';
import { ReservationStatusService } from './reservation-status.service';
import { ReservationStorageService } from './reservation-storage.service';

const createReservationCommandService = () => {
  const tx = {
    reservations: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    storages: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    reservations: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    stores: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const reservationQueryService = {
    reservationNotFound: jest.fn(() => new Error('not found')),
  };
  const reservationStatusService = new ReservationStatusService();
  const reservationStorageService = new ReservationStorageService(
    prisma as never,
  );
  const couponAutoIssueService = {
    issueForTrigger: jest.fn().mockResolvedValue([]),
  };

  const reservationPricingService = new ReservationPricingService();
  const mailService = {
    sendReservationCreatedEmail: jest.fn().mockResolvedValue(undefined),
  };
  const notificationsService = {
    notifyCheckoutReview: jest.fn(),
  };

  return {
    service: new ReservationCommandService(
      prisma as never,
      reservationQueryService as never,
      reservationStatusService,
      reservationStorageService,
      couponAutoIssueService as never,
      reservationPricingService,
      mailService as never,
      notificationsService as never,
    ),
    prisma,
    tx,
    couponAutoIssueService,
    mailService,
    notificationsService,
  };
};

describe('ReservationCommandService', () => {
  it('rejects a customer reservation for a withdrawn store', async () => {
    const { service, prisma } = createReservationCommandService();

    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_withdrawn',
      business_name: '폐점한 매장',
      closed_at: new Date('2026-10-01T00:00:00.000Z'),
    });

    await expect(
      service.createCustomerReservation('customer_1', {
        storeId: 'store_withdrawn',
        customerName: '홍길동',
        phoneNumber: '01012345678',
        startTime: '2026-04-27T10:00:00+09:00',
        duration: 4,
        bagCount: 1,
        storageType: reservations_requested_storage_type.s,
      }),
    ).rejects.toMatchObject({ response: { code: 'STORE_NOT_FOUND' } });
    expect(prisma.reservations.create).not.toHaveBeenCalled();
  });

  it('approves a reservation and assigns an available storage in one transaction', async () => {
    const { service, tx } = createReservationCommandService();
    const startTime = new Date('2026-04-27T01:00:00.000Z');
    const endTime = new Date('2026-04-27T03:00:00.000Z');

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_1',
      store_id: 'store_1',
      status: reservations_status.pending,
      start_time: startTime,
      end_time: endTime,
      storage_id: null,
      storage_number: null,
      requested_storage_type: reservations_requested_storage_type.s,
      confirmed_at: null,
    });
    tx.storages.findFirst.mockResolvedValue({
      id: 'storage_1',
      number: 'S1',
    });

    const result = await service.approveReservation('store_1', 'res_1');

    expect(tx.storages.update).toHaveBeenCalledWith({
      where: { id: 'storage_1' },
      data: expect.objectContaining({ status: storages_status.occupied }),
    });
    expect(tx.reservations.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: expect.objectContaining({
        status: reservations_status.confirmed,
        storage_id: 'storage_1',
        storage_number: 'S1',
      }),
    });
    expect(result).toMatchObject({
      id: 'res_1',
      status: reservations_status.confirmed,
      storageId: 'storage_1',
      storageNumber: 'S1',
    });
  });

  it('sends a reservation email after customer reservation creation', async () => {
    const { service, prisma, tx, mailService } =
      createReservationCommandService();
    const createdReservation = {
      id: 'res_1',
      store_id: 'store_1',
      customer_id: 'customer_1',
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: 'guest@example.com',
      locale: 'ja',
      status: reservations_status.pending,
      start_time: new Date('2026-04-27T01:00:00.000Z'),
      end_time: new Date('2026-04-27T05:00:00.000Z'),
      request_time: new Date('2026-04-27T00:00:00.000Z'),
      duration: 4,
      bag_count: 2,
      total_amount: 9000,
      message: null,
      storage_id: null,
      storage_number: null,
      requested_storage_type: reservations_requested_storage_type.s,
      special_requests: null,
      payment_status: null,
      payment_method: 'card',
      created_at: new Date('2026-04-27T00:00:00.000Z'),
      actual_start_time: null,
      actual_end_time: null,
    };

    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_1',
      business_name: '테스트 매장',
    });
    prisma.reservations.create.mockResolvedValue(createdReservation);
    // 생성 직후 자동 승인 경로: 예약을 찾고 가용 보관함을 할당한다.
    tx.reservations.findFirst.mockResolvedValue(createdReservation);
    tx.storages.findFirst.mockResolvedValue({ id: 'storage_1', number: 'S1' });
    prisma.reservations.findUnique.mockResolvedValue({
      ...createdReservation,
      status: reservations_status.confirmed,
      storage_id: 'storage_1',
      storage_number: 'S1',
    });

    const result = await service.createCustomerReservation('customer_1', {
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '01012345678',
      email: 'guest@example.com',
      locale: 'ja',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 2,
      storageType: reservations_requested_storage_type.s,
    });

    expect(mailService.sendReservationCreatedEmail).toHaveBeenCalledWith(
      'guest@example.com',
      expect.objectContaining({
        reservationId: 'res_1',
        customerName: '홍길동',
        storeName: '테스트 매장',
      }),
    );
    expect(prisma.reservations.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locale: 'ja',
      }),
    });
    expect(result.locale).toBe('ja');
    expect(result.id).toBe('res_1');
    // 생성 직후 자동 승인되어 confirmed 상태로 응답된다.
    expect(result.status).toBe(reservations_status.confirmed);
  });

  it('auto-approves a store reservation on creation and returns confirmed', async () => {
    const { service, prisma, tx } = createReservationCommandService();
    const createdReservation = {
      id: 'res_2',
      store_id: 'store_1',
      customer_id: 'cust_1',
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: null,
      locale: 'ko',
      status: reservations_status.pending,
      start_time: new Date('2026-04-27T01:00:00.000Z'),
      end_time: new Date('2026-04-27T05:00:00.000Z'),
      request_time: new Date('2026-04-27T00:00:00.000Z'),
      duration: 4,
      bag_count: 1,
      total_amount: 9000,
      message: null,
      storage_id: null,
      storage_number: null,
      requested_storage_type: reservations_requested_storage_type.s,
      special_requests: null,
      payment_status: null,
      payment_method: 'card',
      created_at: new Date('2026-04-27T00:00:00.000Z'),
      actual_start_time: null,
      actual_end_time: null,
    };

    prisma.reservations.create.mockResolvedValue(createdReservation);
    tx.reservations.findFirst.mockResolvedValue(createdReservation);
    tx.storages.findFirst.mockResolvedValue({ id: 'storage_9', number: 'S9' });
    prisma.reservations.findUnique.mockResolvedValue({
      ...createdReservation,
      status: reservations_status.confirmed,
      storage_id: 'storage_9',
      storage_number: 'S9',
    });

    const result = await service.createStoreReservation('store_1', {
      customerName: '홍길동',
      phoneNumber: '01012345678',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 1,
      storageType: reservations_requested_storage_type.s,
    });

    expect(tx.reservations.update).toHaveBeenCalledWith({
      where: { id: 'res_2' },
      data: expect.objectContaining({
        status: reservations_status.confirmed,
        storage_id: 'storage_9',
        storage_number: 'S9',
      }),
    });
    expect(result.status).toBe(reservations_status.confirmed);
    expect(result.storageNumber).toBe('S9');
  });

  it('keeps a reservation pending when no storage is available on creation', async () => {
    const { service, prisma, tx } = createReservationCommandService();
    const createdReservation = {
      id: 'res_3',
      store_id: 'store_1',
      customer_id: 'cust_1',
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: null,
      locale: 'ko',
      status: reservations_status.pending,
      start_time: new Date('2026-04-27T01:00:00.000Z'),
      end_time: new Date('2026-04-27T05:00:00.000Z'),
      request_time: new Date('2026-04-27T00:00:00.000Z'),
      duration: 4,
      bag_count: 1,
      total_amount: 9000,
      message: null,
      storage_id: null,
      storage_number: null,
      requested_storage_type: reservations_requested_storage_type.s,
      special_requests: null,
      payment_status: null,
      payment_method: 'card',
      created_at: new Date('2026-04-27T00:00:00.000Z'),
      actual_start_time: null,
      actual_end_time: null,
    };

    prisma.reservations.create.mockResolvedValue(createdReservation);
    tx.reservations.findFirst.mockResolvedValue(createdReservation);
    // 가용 보관함 없음 → assignAvailableStorage가 NO_AVAILABLE_STORAGE를 던진다.
    tx.storages.findFirst.mockResolvedValue(null);
    prisma.reservations.findUnique.mockResolvedValue(createdReservation);

    const result = await service.createStoreReservation('store_1', {
      customerName: '홍길동',
      phoneNumber: '01012345678',
      startTime: '2026-04-27T10:00:00+09:00',
      duration: 4,
      bagCount: 1,
      storageType: reservations_requested_storage_type.s,
    });

    expect(tx.reservations.update).not.toHaveBeenCalled();
    expect(result.status).toBe(reservations_status.pending);
  });

  it('releases assigned storage when a reservation is cancelled', async () => {
    const { service, tx } = createReservationCommandService();

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_1',
      store_id: 'store_1',
      status: reservations_status.confirmed,
      storage_id: 'storage_1',
    });

    const result = await service.cancelReservation('store_1', 'res_1');

    expect(tx.reservations.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: expect.objectContaining({
        status: reservations_status.cancelled,
      }),
    });
    expect(tx.storages.update).toHaveBeenCalledWith({
      where: { id: 'storage_1' },
      data: expect.objectContaining({ status: storages_status.available }),
    });
    expect(result).toEqual({
      id: 'res_1',
      status: reservations_status.cancelled,
    });
  });

  it('completes a customer reservation and releases assigned storage on checkout', async () => {
    const { service, tx } = createReservationCommandService();

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_1',
      customer_id: 'cust_1',
      status: reservations_status.in_progress,
      storage_id: 'storage_1',
      actual_end_time: null,
    });

    const result = await service.customerCheckout('cust_1', 'res_1');

    expect(tx.reservations.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'res_1',
        customer_id: 'cust_1',
      },
    });
    expect(tx.reservations.update).toHaveBeenCalledWith({
      where: { id: 'res_1' },
      data: expect.objectContaining({
        status: reservations_status.completed,
      }),
    });
    expect(tx.storages.update).toHaveBeenCalledWith({
      where: { id: 'storage_1' },
      data: expect.objectContaining({ status: storages_status.available }),
    });
    expect(result).toEqual({
      id: 'res_1',
      status: reservations_status.completed,
    });
  });

  it('issues phone based coupons after guest checkin succeeds', async () => {
    const { service, tx, couponAutoIssueService } =
      createReservationCommandService();

    tx.reservations.findFirst.mockResolvedValue({
      id: 'res_1',
      store_id: 'store_1',
      customer_id: 'guest_01012345678_1',
      customer_phone: '010-1234-5678',
      status: reservations_status.confirmed,
      actual_start_time: null,
      luggage_image_urls: null,
    });

    const result = await service.storeCheckin('store_1', 'res_1', {
      photoUrls: [],
    });

    expect(couponAutoIssueService.issueForTrigger).toHaveBeenCalledWith({
      customerId: null,
      phoneSnapshot: '010-1234-5678',
      storeId: 'store_1',
      trigger: 'checkin_completed',
      reservationId: 'res_1',
    });
    expect(result).toEqual({
      id: 'res_1',
      status: reservations_status.in_progress,
      photos: [],
    });
  });

  describe('updateReservationStatus', () => {
    const baseRow = {
      id: 'res_1',
      store_id: 'store_1',
      status: reservations_status.in_progress,
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: null,
      locale: 'ko',
      qr_code: 'guest-token',
      actual_start_time: new Date('2026-07-20T01:00:00.000Z'),
      actual_end_time: null,
      storage_id: null,
    };

    it('completed 전환 시 고객 리뷰 요청 fan-out을 호출한다 (점주앱 체크아웃 경로)', async () => {
      const { service, tx, notificationsService } =
        createReservationCommandService();
      tx.reservations.findFirst.mockResolvedValue(baseRow);
      tx.reservations.update.mockResolvedValue({});

      const result = await service.updateReservationStatus(
        'store_1',
        'res_1',
        reservations_status.completed,
      );

      expect(notificationsService.notifyCheckoutReview).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'res_1',
          customer_phone: '01012345678',
          qr_code: 'guest-token',
        }),
      );
      expect(result).toEqual({
        id: 'res_1',
        status: reservations_status.completed,
      });
    });

    it('completed 이외의 전환에서는 리뷰 요청을 보내지 않는다', async () => {
      const { service, tx, notificationsService } =
        createReservationCommandService();
      tx.reservations.findFirst.mockResolvedValue({
        ...baseRow,
        status: reservations_status.confirmed,
        actual_start_time: null,
      });
      tx.reservations.update.mockResolvedValue({});

      await service.updateReservationStatus(
        'store_1',
        'res_1',
        reservations_status.in_progress,
      );

      expect(notificationsService.notifyCheckoutReview).not.toHaveBeenCalled();
    });

    it('이미 completed인 예약의 completed 재요청(멱등)은 성공하되 리뷰 요청을 재발송하지 않는다', async () => {
      const { service, tx, notificationsService } =
        createReservationCommandService();
      tx.reservations.findFirst.mockResolvedValue({
        ...baseRow,
        status: reservations_status.completed,
      });
      tx.reservations.update.mockResolvedValue({});

      const result = await service.updateReservationStatus(
        'store_1',
        'res_1',
        reservations_status.completed,
      );

      expect(result.status).toBe(reservations_status.completed);
      expect(notificationsService.notifyCheckoutReview).not.toHaveBeenCalled();
    });
  });
});
