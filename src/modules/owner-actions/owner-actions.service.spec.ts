/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  reservations_payment_status,
  reservations_status,
} from '@prisma/client';
import { OwnerActionsService } from './owner-actions.service';

const createService = () => {
  const tx = {
    reservations: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    storages: { updateMany: jest.fn() },
  };
  const prisma = {
    reservations: { findFirst: jest.fn(), findMany: jest.fn() },
    stores: { findFirst: jest.fn() },
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const reservationStorageService = {
    releaseStorageIfAny: jest.fn().mockResolvedValue(undefined),
  };
  const notificationsService = {
    notifyCheckoutReview: jest.fn(),
  };
  const service = new OwnerActionsService(
    prisma as never,
    reservationStorageService as never,
    notificationsService as never,
  );
  return {
    service,
    prisma,
    tx,
    reservationStorageService,
    notificationsService,
  };
};

const baseRow = {
  id: 'res_1',
  store_id: 'store_1',
  customer_name: '홍길동',
  customer_phone: '01012345678',
  customer_email: null,
  locale: 'ko',
  status: reservations_status.confirmed,
  start_time: new Date(Date.now() - 60 * 60 * 1000),
  end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
  actual_start_time: null,
  actual_end_time: null,
  storage_id: 'storage_1',
  qr_code: 'guest-token',
  reservation_group_id: 'res_1',
  requested_storage_type: 's',
  bag_count: 2,
};

describe('OwnerActionsService', () => {
  it('checkIn moves a confirmed group to in_progress', async () => {
    const { service, tx } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);

    const result = await service.checkIn('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['res_1'] } }),
        data: expect.objectContaining({
          status: reservations_status.in_progress,
          actual_start_time: expect.any(Date),
        }),
      }),
    );
    expect(result.status).toBe(reservations_status.in_progress);
  });

  it('checkIn marks a pending-payment (현장결제) group as paid', async () => {
    const { service, tx } = createService();
    const row = {
      ...baseRow,
      payment_status: reservations_payment_status.pending,
    };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await service.checkIn('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_status: reservations_payment_status.paid,
        }),
      }),
    );
  });

  it('checkIn leaves an already-paid (온라인 결제) group untouched', async () => {
    const { service, tx } = createService();
    const row = {
      ...baseRow,
      payment_status: reservations_payment_status.paid,
    };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await service.checkIn('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          payment_status: expect.anything(),
        }),
      }),
    );
  });

  it('checkOut marks a pending-payment group as paid (체크인 생략 케이스)', async () => {
    const { service, prisma, tx } = createService();
    const row = {
      ...baseRow,
      status: reservations_status.confirmed,
      payment_status: reservations_payment_status.pending,
    };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);
    prisma.stores.findFirst.mockResolvedValue({ business_name: '테스트 매장' });

    await service.checkOut('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: reservations_status.completed,
          payment_status: reservations_payment_status.paid,
        }),
      }),
    );
  });

  it('checkIn rejects a reservation that is not confirmed', async () => {
    const { service, tx } = createService();
    const row = { ...baseRow, status: reservations_status.completed };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await expect(service.checkIn('res_1')).rejects.toMatchObject({
      response: { code: 'INVALID_TRANSITION' },
    });
  });

  it('checkOut completes, releases storage, and sends the review request', async () => {
    const {
      service,
      prisma,
      tx,
      reservationStorageService,
      notificationsService,
    } = createService();
    const row = { ...baseRow, status: reservations_status.in_progress };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);
    prisma.stores.findFirst.mockResolvedValue({ business_name: '테스트 매장' });

    const result = await service.checkOut('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: reservations_status.completed,
          actual_end_time: expect.any(Date),
        }),
      }),
    );
    expect(reservationStorageService.releaseStorageIfAny).toHaveBeenCalledWith(
      tx,
      'storage_1',
    );
    expect(notificationsService.notifyCheckoutReview).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'res_1',
        customer_phone: '01012345678',
        locale: 'ko',
        qr_code: 'guest-token',
      }),
    );
    expect(result.status).toBe(reservations_status.completed);
  });

  it('noShow rejects before start_time', async () => {
    const { service, tx } = createService();
    const row = {
      ...baseRow,
      start_time: new Date(Date.now() + 60 * 60 * 1000),
    };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await expect(service.noShow('res_1')).rejects.toMatchObject({
      response: { code: 'TOO_EARLY_FOR_NO_SHOW' },
    });
  });

  it('noShow marks a past-start confirmed group as no_show and releases storage', async () => {
    const { service, tx, reservationStorageService } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);

    const result = await service.noShow('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: reservations_status.no_show }),
      }),
    );
    expect(reservationStorageService.releaseStorageIfAny).toHaveBeenCalled();
    expect(result.status).toBe(reservations_status.no_show);
  });

  it('checkOut on an already-completed reservation throws and does not send a review request', async () => {
    const { service, tx, notificationsService } = createService();
    const row = { ...baseRow, status: reservations_status.completed };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await expect(service.checkOut('res_1')).rejects.toMatchObject({
      response: { code: 'INVALID_TRANSITION' },
    });
    expect(notificationsService.notifyCheckoutReview).not.toHaveBeenCalled();
  });

  it('throws INVALID_TRANSITION when the CAS update matches fewer rows than members (race lost)', async () => {
    const { service, tx, notificationsService } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);
    tx.reservations.updateMany.mockResolvedValue({ count: 0 }); // 경합 패배 시뮬레이션

    await expect(service.checkOut('res_1')).rejects.toMatchObject({
      response: { code: 'INVALID_TRANSITION' },
    });
    expect(notificationsService.notifyCheckoutReview).not.toHaveBeenCalled();
  });

  it('CAS updateMany filters by allowed statuses', async () => {
    const { service, tx } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);

    await service.checkIn('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: expect.arrayContaining([reservations_status.confirmed]),
          },
        }),
      }),
    );
  });

  it('checkIn works for a mixed group with a pending member (physical confirmation wins)', async () => {
    const { service, tx } = createService();
    const pendingMember = {
      ...baseRow,
      id: 'res_2',
      status: reservations_status.pending,
      reservation_group_id: 'res_1',
    };
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow, pendingMember]);
    tx.reservations.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.checkIn('res_1');
    expect(result.updatedCount).toBe(2);
  });

  it('getSummary exposes customer contact for owner alimtalk link', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue(baseRow);
    prisma.reservations.findMany.mockResolvedValue([baseRow]);

    const summary = await service.getSummary('res_1');

    expect(summary.customerName).toBe('01012345678');
    expect(summary.phoneNumber).toBe('01012345678');
    expect(summary.email).toBeNull();
    expect(summary.items).toEqual([{ storageType: 's', bagCount: 2 }]);
  });
});
