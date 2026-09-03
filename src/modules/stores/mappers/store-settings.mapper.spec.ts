import { Prisma } from '@prisma/client';
import { toStoreSettingsResponse } from './store-settings.mapper';

describe('toStoreSettingsResponse', () => {
  it('returns category objects for Flutter StoreSettings parsing', () => {
    const category = { id: 'wine-bar', name: '와인바', items: [] };

    const response = toStoreSettingsResponse({
      storeId: 'store_1',
      settings: {
        categories: [[], [category]] as Prisma.JsonArray,
      } as never,
    });

    expect(response.categories).toEqual([category]);
  });

  it('maps reservationWaitMenuItemIds from store_settings JSON column', () => {
    const response = toStoreSettingsResponse({
      storeId: 'store_1',
      settings: {
        store_photos: ['https://example.com/store.jpg'],
        reservation_wait_menu_item_ids: ['latte', 'banana-bread'],
      } as never,
    });

    expect(response.reservationWaitMenuItemIds).toEqual(['latte', 'banana-bread']);
    expect(response.basicInfo.storePhotos).toEqual(['https://example.com/store.jpg']);
  });
});
