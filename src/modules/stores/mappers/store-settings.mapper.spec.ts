import { Prisma } from '@prisma/client';
import { toStoreSettingsResponse } from './store-settings.mapper';

describe('toStoreSettingsResponse', () => {
  it('returns only category objects for Flutter StoreSettings parsing', () => {
    const category = { id: 'wine-bar', name: '와인바', items: [] };

    const response = toStoreSettingsResponse({
      storeId: 'store_1',
      settings: {
        categories: [[], category] as Prisma.JsonArray,
      } as never,
    });

    expect(response.categories).toEqual([category]);
  });
});
