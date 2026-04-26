/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { UnauthorizedException } from '@nestjs/common';
import { StorePinService } from './store-pin.service';

const createStorePinService = () => {
  const prisma = {
    stores: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const passwordService = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  return {
    service: new StorePinService(prisma as never, passwordService),
    prisma,
    passwordService,
  };
};

describe('StorePinService', () => {
  it('increments PIN failure count and returns remaining attempts', async () => {
    const { service, prisma, passwordService } = createStorePinService();

    prisma.stores.findUnique.mockResolvedValue({
      id: 'store_1',
      store_pin_hash: 'hashed-pin',
      store_pin_failed_count: 2,
      store_pin_locked_until: null,
    });
    passwordService.compare.mockResolvedValue(false);
    prisma.stores.update.mockResolvedValue({});

    await expect(
      service.checkPin('store_1', { pin: '1234' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.stores.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: expect.objectContaining({
        store_pin_failed_count: 3,
        store_pin_locked_until: null,
      }),
    });
  });
});
