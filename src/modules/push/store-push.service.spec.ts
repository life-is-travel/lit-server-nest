/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { StorePushService } from './store-push.service';

const createService = (tokens: string[] = []) => {
  const prisma = {
    store_push_devices: {
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest
        .fn()
        .mockResolvedValue(tokens.map((push_token) => ({ push_token }))),
    },
  };
  const fcmSender = {
    send: jest.fn().mockResolvedValue({ successCount: 0, staleTokens: [] }),
  };
  const service = new StorePushService(prisma as never, fcmSender as never);
  return { service, prisma, fcmSender };
};

const message = {
  title: '새 예약이 들어왔어요',
  body: '홍길동 · 소형 1개',
  data: { type: 'reservation_created', reservationId: 'res_1' },
};

describe('StorePushService', () => {
  it('점주 기기는 staff_id 없이 토큰 기준으로 upsert한다', async () => {
    const { service, prisma } = createService();

    await service.registerDevice(
      { storeId: 'store_1', role: 'owner', type: 'access' },
      'tok_1',
      'ios',
    );

    expect(prisma.store_push_devices.upsert).toHaveBeenCalledWith({
      where: { push_token: 'tok_1' },
      create: expect.objectContaining({
        push_token: 'tok_1',
        store_id: 'store_1',
        staff_id: null,
        platform: 'ios',
      }),
      update: expect.objectContaining({ store_id: 'store_1', staff_id: null }),
    });
  });

  it('직원 기기는 staff_id를 함께 저장한다', async () => {
    const { service, prisma } = createService();

    await service.registerDevice(
      { storeId: 'store_1', role: 'staff', staffId: 'staff_1', type: 'access' },
      'tok_2',
      'android',
    );

    expect(prisma.store_push_devices.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ staff_id: 'staff_1' }),
      }),
    );
  });

  it('해제는 자기 매장의 토큰만 지운다', async () => {
    const { service, prisma } = createService();

    await service.unregisterDevice('store_1', 'tok_1');

    expect(prisma.store_push_devices.deleteMany).toHaveBeenCalledWith({
      where: { store_id: 'store_1', push_token: 'tok_1' },
    });
  });

  it('점주 기기와 활성 직원 기기만 조회해 발송한다', async () => {
    const { service, prisma, fcmSender } = createService(['tok_1', 'tok_2']);

    await service.notifyStore('store_1', message);

    expect(prisma.store_push_devices.findMany).toHaveBeenCalledWith({
      where: {
        store_id: 'store_1',
        OR: [{ staff_id: null }, { store_staff: { status: 'active' } }],
      },
      select: { push_token: true },
    });
    expect(fcmSender.send).toHaveBeenCalledWith(['tok_1', 'tok_2'], message);
  });

  it('기기가 없으면 발송하지 않는다', async () => {
    const { service, fcmSender } = createService([]);

    await service.notifyStore('store_1', message);

    expect(fcmSender.send).not.toHaveBeenCalled();
  });

  it('만료된 토큰은 발송 후 지운다', async () => {
    const { service, prisma, fcmSender } = createService(['tok_1', 'tok_2']);
    fcmSender.send.mockResolvedValue({
      successCount: 1,
      staleTokens: ['tok_2'],
    });

    await service.notifyStore('store_1', message);

    expect(prisma.store_push_devices.deleteMany).toHaveBeenCalledWith({
      where: { push_token: { in: ['tok_2'] } },
    });
  });
});
