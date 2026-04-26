/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { storages_status } from '@prisma/client';
import { StoragesCommandService } from './storages-command.service';

const createStoragesCommandService = () => {
  const prisma = {
    storages: {
      update: jest.fn(),
    },
  };
  const storagePolicyService = {
    assertStoreExists: jest.fn(),
    assertStorageNumberAvailable: jest.fn(),
    getStorageOrThrow: jest.fn(),
    assertCanUpdateStorage: jest.fn(),
    assertCanDeleteOrDeactivate: jest.fn(),
  };

  return {
    service: new StoragesCommandService(
      prisma as never,
      storagePolicyService as never,
    ),
    prisma,
    storagePolicyService,
  };
};

describe('StoragesCommandService', () => {
  it('turns DELETE into maintenance status instead of hard deleting', async () => {
    const { service, prisma, storagePolicyService } =
      createStoragesCommandService();

    storagePolicyService.getStorageOrThrow.mockResolvedValue({
      id: 'storage_1',
      store_id: 'store_1',
      status: storages_status.available,
    });
    prisma.storages.update.mockResolvedValue({});

    const result = await service.deleteStorage('store_1', 'storage_1');

    expect(storagePolicyService.assertCanDeleteOrDeactivate).toHaveBeenCalled();
    expect(prisma.storages.update).toHaveBeenCalledWith({
      where: { id: 'storage_1' },
      data: expect.objectContaining({
        status: storages_status.maintenance,
      }),
    });
    expect(result).toEqual({
      id: 'storage_1',
      deleted: false,
      status: storages_status.maintenance,
    });
  });
});
