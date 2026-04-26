/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { BadRequestException } from '@nestjs/common';
import { stores } from '@prisma/client';
import { StoresService } from './stores.service';

const createStore = (): stores => ({
  id: 'store_1',
  email: 'store@example.com',
  password_hash: 'hashed-password',
  store_pin_hash: null,
  store_pin_updated_at: null,
  store_pin_failed_count: 0,
  store_pin_locked_until: null,
  phone_number: '01012345678',
  store_phone_number: '050700000000',
  wants_sms_notification: true,
  business_type: 'RESTAURANT',
  profile_image_url: null,
  has_completed_setup: false,
  business_number: '1234567890',
  business_name: '루라운지 혼술바',
  slug: 'store-test',
  representative_name: '홍길동',
  address: '서울 용산구 한강대로44길 5',
  detail_address: '지하 1층',
  latitude: null,
  longitude: null,
  description: '매장 소개',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
});

const createStoresService = () => {
  const prisma = {
    stores: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    service: new StoresService(prisma as never),
    prisma,
  };
};

describe('StoresService', () => {
  it('maps a profile name update to business_name instead of a non-existing name column', async () => {
    const { service, prisma } = createStoresService();
    const store = createStore();

    prisma.stores.findUnique.mockResolvedValue(store);
    prisma.stores.update.mockResolvedValue({
      ...store,
      business_name: '새 매장명',
    });

    const result = await service.updateProfile('store_1', {
      name: '새 매장명',
    });

    expect(prisma.stores.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'store_1' },
        data: expect.objectContaining({
          business_name: '새 매장명',
        }),
      }),
    );
    expect(result.businessName).toBe('새 매장명');
  });

  it('rejects an empty profile update', async () => {
    const { service } = createStoresService();

    await expect(service.updateProfile('store_1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
