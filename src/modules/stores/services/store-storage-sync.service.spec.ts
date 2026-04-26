/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { storages_status, storages_type } from '@prisma/client';
import { StoreStorageSyncService } from './store-storage-sync.service';

const createTx = () => ({
  storages: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('StoreStorageSyncService', () => {
  it('does not delete storages when capacity is reduced; available excess storages become maintenance', async () => {
    const service = new StoreStorageSyncService();
    const tx = createTx();

    tx.storages.findMany
      .mockResolvedValueOnce([
        {
          id: 'storage_1',
          store_id: 'store_1',
          number: 'S1',
          type: storages_type.s,
          status: storages_status.available,
          pricing: 2000,
        },
        {
          id: 'storage_2',
          store_id: 'store_1',
          number: 'S2',
          type: storages_type.s,
          status: storages_status.available,
          pricing: 2000,
        },
      ])
      .mockResolvedValue([]);
    tx.storages.updateMany.mockResolvedValue({ count: 1 });

    await service.syncFromSettings(tx as never, 'store_1', {
      extraSmall: {
        hourlyRate: 2000,
        dailyRate: 15000,
        hourUnit: 1,
        maxCapacity: 1,
      },
      isExtraSmallEnabled: true,
    });

    expect(tx.storages.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['storage_2'] } },
      data: expect.objectContaining({
        status: storages_status.maintenance,
      }),
    });
    expect(tx.storages).not.toHaveProperty('deleteMany');
  });
});
