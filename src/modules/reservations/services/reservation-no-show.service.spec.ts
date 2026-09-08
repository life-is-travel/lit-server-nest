/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { reservations_status } from '@prisma/client';
import { ReservationNoShowService } from './reservation-no-show.service';

const createService = () => {
  const tx = {
    reservations: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const reservationStorageService = {
    releaseStorageIfAny: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new ReservationNoShowService(
      prisma as never,
      reservationStorageService as never,
    ),
    tx,
    reservationStorageService,
  };
};

const baseRow = {
  id: 'res_1',
  store_id: 'store_1',
  status: reservations_status.confirmed,
  start_time: new Date(Date.now() - 60 * 60 * 1000),
  end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
  storage_id: 'storage_1',
  reservation_group_id: 'res_1',
};

describe('ReservationNoShowService', () => {
  it('marks a past-start confirmed group as no_show and releases storage', async () => {
    const { service, tx, reservationStorageService } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);

    const result = await service.markNoShow('res_1');

    expect(tx.reservations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: reservations_status.no_show }),
      }),
    );
    expect(reservationStorageService.releaseStorageIfAny).toHaveBeenCalledWith(
      tx,
      'storage_1',
    );
    expect(result.status).toBe(reservations_status.no_show);
  });

  it('rejects before start_time', async () => {
    const { service, tx } = createService();
    const row = {
      ...baseRow,
      start_time: new Date(Date.now() + 60 * 60 * 1000),
    };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await expect(service.markNoShow('res_1')).rejects.toMatchObject({
      response: { code: 'TOO_EARLY_FOR_NO_SHOW' },
    });
    expect(tx.reservations.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an already checked-in (in_progress) reservation', async () => {
    const { service, tx } = createService();
    const row = { ...baseRow, status: reservations_status.in_progress };
    tx.reservations.findFirst.mockResolvedValue(row);
    tx.reservations.findMany.mockResolvedValue([row]);

    await expect(service.markNoShow('res_1')).rejects.toMatchObject({
      response: { code: 'INVALID_TRANSITION' },
    });
  });

  it('transitions every member of a 규격별 복수 예약 group', async () => {
    const { service, tx, reservationStorageService } = createService();
    const secondMember = {
      ...baseRow,
      id: 'res_2',
      status: reservations_status.pending,
      storage_id: 'storage_2',
    };
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow, secondMember]);
    tx.reservations.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markNoShow('res_2');

    // 그룹 대표(res_1)를 응답 id로 돌려주고, 멤버 전 행의 보관함을 반납한다
    expect(result.id).toBe('res_1');
    expect(result.updatedCount).toBe(2);
    expect(reservationStorageService.releaseStorageIfAny).toHaveBeenCalledTimes(
      2,
    );
  });

  it('throws INVALID_TRANSITION when the CAS update matches fewer rows (race lost)', async () => {
    const { service, tx, reservationStorageService } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);
    tx.reservations.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markNoShow('res_1')).rejects.toMatchObject({
      response: { code: 'INVALID_TRANSITION' },
    });
    expect(
      reservationStorageService.releaseStorageIfAny,
    ).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the store when storeId is given (매장 앱 경로)', async () => {
    const { service, tx } = createService();
    tx.reservations.findFirst.mockResolvedValue(baseRow);
    tx.reservations.findMany.mockResolvedValue([baseRow]);

    await service.markNoShow('res_1', { storeId: 'store_1' });

    expect(tx.reservations.findFirst).toHaveBeenCalledWith({
      where: { id: 'res_1', store_id: 'store_1' },
    });
    expect(tx.reservations.findMany).toHaveBeenCalledWith({
      where: { reservation_group_id: 'res_1', store_id: 'store_1' },
    });
  });

  it('throws RESERVATION_NOT_FOUND for another store reservation', async () => {
    const { service, tx } = createService();
    tx.reservations.findFirst.mockResolvedValue(null);

    await expect(
      service.markNoShow('res_1', { storeId: 'store_other' }),
    ).rejects.toMatchObject({
      response: { code: 'RESERVATION_NOT_FOUND' },
    });
  });
});
