/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  reservations_requested_storage_type,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { ReservationCommandService } from './reservation-command.service';
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

  return {
    service: new ReservationCommandService(
      prisma as never,
      reservationQueryService as never,
      reservationStatusService,
      reservationStorageService,
    ),
    prisma,
    tx,
  };
};

describe('ReservationCommandService', () => {
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
});
