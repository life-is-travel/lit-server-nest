/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { FcmSenderService } from './fcm-sender.service';

const sendEachForMulticast = jest.fn();
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn((value: unknown) => value),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
  initializeApp: jest.fn(() => ({ name: 'lit-store-push' })),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ sendEachForMulticast })),
}));

const serviceAccount = Buffer.from(
  JSON.stringify({
    project_id: 'lit',
    client_email: 'push@lit.iam.gserviceaccount.com',
    private_key: 'key',
  }),
).toString('base64');

const createSender = (encoded?: string) =>
  new FcmSenderService({
    get: jest.fn(() => encoded),
  } as unknown as ConfigService);

const message = {
  title: '예약이 취소됐어요',
  body: '7월 2일 14:00 예약이 취소됐어요.',
  data: { type: 'reservation_cancelled', reservationId: 'res_1' },
};

describe('FcmSenderService', () => {
  beforeEach(() => sendEachForMulticast.mockReset());

  it('서비스 계정이 없으면 보내지 않는다', async () => {
    const result = await createSender(undefined).send(['tok_1'], message);

    expect(result).toEqual({ successCount: 0, staleTokens: [] });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('앱 알림 채널과 같은 channelId로 보내고 만료 토큰만 골라낸다', async () => {
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
        { success: false, error: { code: 'messaging/internal-error' } },
      ],
    });

    const result = await createSender(serviceAccount).send(
      ['tok_1', 'tok_2', 'tok_3'],
      message,
    );

    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok_1', 'tok_2', 'tok_3'],
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: expect.objectContaining({
          notification: expect.objectContaining({
            channelId: 'default_channel',
          }),
        }),
      }),
    );
    expect(result).toEqual({ successCount: 1, staleTokens: ['tok_2'] });
  });
});
