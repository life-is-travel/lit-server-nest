import { Prisma } from '@prisma/client';
import { toStoreSettingsResponse } from './store-settings.mapper';

describe('toStoreSettingsResponse', () => {
  it('preserves categories JSON object shape from existing Express API', () => {
    const categories = {
      selected: [
        { id: 'wine-bar', name: '와인바' },
        { id: 'luggage-storage', name: '짐보관' },
      ],
    };

    const response = toStoreSettingsResponse({
      storeId: 'store_1',
      settings: {
        categories: categories as Prisma.JsonObject,
      } as never,
    });

    expect(response.categories).toEqual(categories);
  });
});

