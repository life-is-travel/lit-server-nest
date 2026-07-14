/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PushTokensService } from './push-tokens.service';

const createService = () => {
  const prisma = {
    owner_push_tokens: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return {
    service: new PushTokensService(prisma as never),
    prisma,
  };
};

describe('PushTokensService', () => {
  describe('register', () => {
    it('upserts by token: creates with a prefixed id and stores platform/store_id', async () => {
      const { service, prisma } = createService();
      prisma.owner_push_tokens.upsert.mockResolvedValue({
        id: 'push_token_generated',
      });

      const result = await service.register('store_1', {
        token: 'fcm-abc',
        platform: 'ios',
      });

      expect(result).toEqual({ id: 'push_token_generated' });
      expect(prisma.owner_push_tokens.upsert).toHaveBeenCalledWith({
        where: { token: 'fcm-abc' },
        create: {
          id: expect.stringMatching(/^push_token_/),
          store_id: 'store_1',
          token: 'fcm-abc',
          platform: 'ios',
        },
        // 재로그인/계정 전환: 기존 토큰이면 store_id·platform 갱신
        update: {
          store_id: 'store_1',
          platform: 'ios',
          updated_at: expect.any(Date),
        },
      });
    });
  });

  describe('remove', () => {
    it('deletes the matching token regardless of owner and returns the count', async () => {
      const { service, prisma } = createService();
      prisma.owner_push_tokens.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.remove({ token: 'fcm-abc' });

      expect(prisma.owner_push_tokens.deleteMany).toHaveBeenCalledWith({
        where: { token: 'fcm-abc' },
      });
      expect(result).toEqual({ deleted: 1 });
    });

    it('returns deleted: 0 when the token was not found', async () => {
      const { service, prisma } = createService();
      prisma.owner_push_tokens.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.remove({ token: 'missing' });

      expect(result).toEqual({ deleted: 0 });
    });
  });
});
