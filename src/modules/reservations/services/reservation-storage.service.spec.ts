/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  reservations_requested_storage_type,
  storages_status,
  storages_type,
} from '@prisma/client';
import { ReservationStorageService } from './reservation-storage.service';

const createTx = () => ({
  storages: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('ReservationStorageService', () => {
  const params = {
    storeId: 'store_1',
    startTime: new Date('2026-05-01T01:00:00.000Z'),
    endTime: new Date('2026-05-01T05:00:00.000Z'),
  };

  it('레거시 특대(xl) 요청도 대형(l) 보관함에서 번호순으로 고르고 상태는 바꾸지 않는다', async () => {
    const service = new ReservationStorageService({} as never);
    const tx = createTx();
    tx.storages.findFirst.mockResolvedValue({ id: 'storage_l1', number: 'L1' });

    const result = await service.findStorageForReservation(tx as never, {
      ...params,
      storageType: reservations_requested_storage_type.xl,
    });

    expect(tx.storages.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: storages_type.l,
          // 현재 상태(occupied)로 거르면 미래 예약 하나가 보관함을 통째로 막는다.
          // 점검 중만 빼고, 비어 있는지는 시간 겹침으로만 본다.
          status: { not: storages_status.maintenance },
          reservations: {
            none: expect.objectContaining({
              start_time: { lt: params.endTime },
              end_time: { gt: params.startTime },
            }),
          },
        }),
        orderBy: { number: 'asc' },
      }),
    );
    expect(tx.storages.update).not.toHaveBeenCalled();
    expect(tx.storages.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'storage_l1', number: 'L1' });
  });

  it('고를 보관함이 없으면 오류 대신 null을 돌려준다', async () => {
    const service = new ReservationStorageService({} as never);
    const tx = createTx();
    tx.storages.findFirst.mockResolvedValue(null);

    await expect(
      service.findStorageForReservation(tx as never, {
        ...params,
        storageType: reservations_requested_storage_type.l,
      }),
    ).resolves.toBeNull();
  });

  it('체크인 시 available인 보관함만 occupied로 바꾸고, 보관함이 없으면 건너뛴다', async () => {
    const service = new ReservationStorageService({} as never);
    const tx = createTx();

    await service.occupyStorageIfAny(tx as never, 'storage_l1');
    await service.occupyStorageIfAny(tx as never, null);

    expect(tx.storages.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.storages.updateMany).toHaveBeenCalledWith({
      where: { id: 'storage_l1', status: storages_status.available },
      data: expect.objectContaining({ status: storages_status.occupied }),
    });
  });
});
