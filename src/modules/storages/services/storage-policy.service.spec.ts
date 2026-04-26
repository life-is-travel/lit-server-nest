import { BadRequestException } from '@nestjs/common';
import { reservations_status, storages_status } from '@prisma/client';
import { StoragePolicyService } from './storage-policy.service';

const createStoragePolicyService = () => {
  const prisma = {
    stores: {
      findUnique: jest.fn(),
    },
    storages: {
      findFirst: jest.fn(),
    },
    reservations: {
      findFirst: jest.fn(),
    },
  };

  return {
    service: new StoragePolicyService(prisma as never),
    prisma,
  };
};

describe('StoragePolicyService', () => {
  it('blocks manual occupied status changes', async () => {
    const { service, prisma } = createStoragePolicyService();

    prisma.reservations.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCanUpdateStorage(
        {
          id: 'storage_1',
          store_id: 'store_1',
          status: storages_status.available,
        } as never,
        { status: storages_status.occupied },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks sensitive updates when an active reservation is linked', async () => {
    const { service, prisma } = createStoragePolicyService();

    prisma.reservations.findFirst.mockResolvedValue({
      id: 'reservation_1',
      status: reservations_status.confirmed,
    });

    await expect(
      service.assertCanUpdateStorage(
        {
          id: 'storage_1',
          store_id: 'store_1',
          status: storages_status.available,
        } as never,
        { number: 'S2' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows non-sensitive updates when an active reservation is linked', async () => {
    const { service, prisma } = createStoragePolicyService();

    prisma.reservations.findFirst.mockResolvedValue({
      id: 'reservation_1',
      status: reservations_status.in_progress,
    });

    await expect(
      service.assertCanUpdateStorage(
        {
          id: 'storage_1',
          store_id: 'store_1',
          status: storages_status.occupied,
        } as never,
        {},
      ),
    ).resolves.toBeUndefined();
  });
});
