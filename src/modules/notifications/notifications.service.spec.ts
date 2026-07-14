/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import {
  CancelNotificationData,
  CreateNotificationData,
  NotificationsService,
} from './notifications.service';
import { getFirebaseMessaging } from './firebase-messaging';

const solapiSendMock = jest.fn().mockResolvedValue(undefined);
jest.mock('solapi', () => ({
  SolapiMessageService: jest.fn().mockImplementation(() => ({
    send: solapiSendMock,
  })),
}));

jest.mock('./firebase-messaging', () => ({
  getFirebaseMessaging: jest.fn(),
}));
const getFirebaseMessagingMock = getFirebaseMessaging as jest.Mock;

const createService = (config: Record<string, string>) => {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService;
  const mailService = {
    sendReviewRequestEmail: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    owner_push_tokens: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const service = new NotificationsService(
    configService,
    mailService as never,
    prisma as never,
  );
  const errorSpy = jest
    .spyOn(
      (
        service as unknown as {
          logger: { error: (...args: unknown[]) => void };
        }
      ).logger,
      'error',
    )
    .mockImplementation(() => undefined);

  return { service, mailService, prisma, errorSpy };
};

const cancelData: CancelNotificationData = {
  reservationId: 'res_abc-123456',
  customerPhone: '01012345678',
  storeName: '테스트 매장',
  ownerPhone: '01099998888',
  luggageType: 's',
  bagCount: 1,
  startTime: new Date('2026-07-02T05:00:00.000Z'),
  cancelledCount: 1,
};

const createData: CreateNotificationData = {
  reservationId: 'res_abc-123456',
  storeName: '테스트 매장',
  storeAddress: '서울',
  ownerPhone: '01099998888',
  customerName: '홍길동',
  customerPhone: '01012345678',
  luggageItems: [{ type: 's', count: 1 }],
  startTime: new Date('2026-07-02T05:00:00.000Z'),
  endTime: new Date('2026-07-02T09:00:00.000Z'),
  duration: 4,
  totalAmount: 4500,
  locale: 'ko',
};

const checkoutData = {
  reservationId: 'res_abc-123456',
  storeName: '테스트 매장',
  customerName: '홍길동',
  customerPhone: '01012345678',
  customerEmail: null as string | null,
  locale: 'ko',
  reviewPath: 'www.lifeistravel.io/review/res_abc?token=tok',
};

describe('NotificationsService', () => {
  beforeEach(() => {
    solapiSendMock.mockClear();
    getFirebaseMessagingMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes a signed owner action url in the create alimtalk when the secret is configured', async () => {
    const { service } = createService({
      SOLAPI_API_KEY: 'k',
      SOLAPI_API_SECRET: 's',
      SOLAPI_KAKAO_PF_ID: 'pf',
      SOLAPI_KAKAO_TEMPLATE_ID: 'tmpl',
      OWNER_ACTION_SECRET: 'test-secret-at-least-32-characters!!',
    });

    await service.sendCreateNotification({
      reservationId: 'res_abc',
      storeName: '테스트 매장',
      storeAddress: '서울',
      ownerPhone: '01099998888',
      customerName: '홍길동',
      customerPhone: '01012345678',
      luggageItems: [{ type: 's', count: 1 }],
      startTime: new Date(),
      endTime: new Date(),
      duration: 4,
      totalAmount: 4500,
      locale: 'ko',
    });

    type SolapiSendArg = {
      kakaoOptions?: {
        templateId?: string;
        variables?: Record<string, string>;
      };
    };
    const ownerCall = (solapiSendMock.mock.calls as [SolapiSendArg][]).find(
      (call) => call[0]?.kakaoOptions?.templateId === 'tmpl',
    );
    expect(ownerCall?.[0].kakaoOptions?.variables?.['#{action_url}']).toMatch(
      /^www\.lifeistravel\.io\/o\/res_abc\?t=[A-Za-z0-9_-]+$/,
    );
  });

  it('fans out the create alimtalk to additional owner recipients (dedup)', async () => {
    const { service } = createService({
      SOLAPI_API_KEY: 'k',
      SOLAPI_API_SECRET: 's',
      SOLAPI_KAKAO_PF_ID: 'pf',
      SOLAPI_KAKAO_TEMPLATE_ID: 'tmpl',
    });

    await service.sendCreateNotification({
      ...createData,
      // 대표 번호와 같은 번호(표기만 다름) 1개 + 새 번호 2개 → 총 3명
      additionalOwnerPhones: ['010-9999-8888', '01011112222', '01033334444'],
    });

    type SolapiSendArg = {
      to?: string;
      kakaoOptions?: { templateId?: string };
    };
    const ownerCalls = (solapiSendMock.mock.calls as [SolapiSendArg][]).filter(
      (call) => call[0]?.kakaoOptions?.templateId === 'tmpl',
    );
    expect(ownerCalls.map((call) => call[0].to)).toEqual([
      '01099998888',
      '01011112222',
      '01033334444',
    ]);
  });

  it('fans out the cancel alimtalk and keeps sending when one recipient fails', async () => {
    const { service } = createService({
      SOLAPI_API_KEY: 'k',
      SOLAPI_API_SECRET: 's',
      SOLAPI_KAKAO_PF_ID: 'pf',
      SOLAPI_KAKAO_CANCEL_TEMPLATE_ID: 'cancel-tmpl',
    });
    solapiSendMock
      .mockRejectedValueOnce(new Error('첫 수신자 실패'))
      .mockResolvedValue(undefined);

    await service.sendCancelNotification({
      ...cancelData,
      additionalOwnerPhones: ['01011112222'],
    });

    type SolapiSendArg = {
      to?: string;
      kakaoOptions?: { templateId?: string };
    };
    const ownerCalls = (solapiSendMock.mock.calls as [SolapiSendArg][]).filter(
      (call) => call[0]?.kakaoOptions?.templateId === 'cancel-tmpl',
    );
    // 첫 수신자 실패에도 두 번째 수신자 발송 시도
    expect(ownerCalls.map((call) => call[0].to)).toEqual([
      '01099998888',
      '01011112222',
    ]);
  });

  it('logs an error when a cancel notification channel fails', async () => {
    const { service, errorSpy } = createService({
      DISCORD_RESERVATION_WEBHOOK_URL: 'https://discord.test/webhook',
    });

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await service.sendCancelNotification(cancelData);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notifications.channel_failed',
        channel: 'discord',
        reservationId: 'res_abc-123456',
      }),
    );
  });

  it('logs an error when a create notification channel fails', async () => {
    const { service, errorSpy } = createService({
      DISCORD_RESERVATION_WEBHOOK_URL: 'https://discord.test/webhook',
    });

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await service.sendCreateNotification(createData);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notifications.channel_failed',
        channel: 'discord',
        reservationId: 'res_abc-123456',
      }),
    );
  });

  it('does not log errors when all channels succeed or are skipped', async () => {
    const { service, errorSpy } = createService({
      DISCORD_RESERVATION_WEBHOOK_URL: 'https://discord.test/webhook',
    });

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
    } as Response);

    await service.sendCancelNotification(cancelData);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  describe('sendCheckoutNotification', () => {
    it('sends the review-request email when the guest booked with an email address', async () => {
      const { service, mailService } = createService({});

      await service.sendCheckoutNotification({
        ...checkoutData,
        customerPhone: 'guest@example.com',
        customerEmail: 'guest@example.com',
        locale: 'en',
      });

      expect(mailService.sendReviewRequestEmail).toHaveBeenCalledWith(
        'guest@example.com',
        expect.objectContaining({
          locale: 'en',
          storeName: '테스트 매장',
          reviewUrl: 'https://www.lifeistravel.io/review/res_abc?token=tok',
        }),
      );
    });

    it('prefers email over LMS for a foreign phone number with an email on file', async () => {
      const { service, mailService } = createService({});

      await service.sendCheckoutNotification({
        ...checkoutData,
        customerPhone: '+14155550123',
        customerEmail: 'traveler@example.com',
        locale: 'en',
      });

      expect(mailService.sendReviewRequestEmail).toHaveBeenCalledWith(
        'traveler@example.com',
        expect.anything(),
      );
    });

    it('skips silently when no solapi env and no email exist (korean phone)', async () => {
      const { service, mailService, errorSpy } = createService({});

      await service.sendCheckoutNotification(checkoutData);

      expect(mailService.sendReviewRequestEmail).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('falls back to Korean LMS with the review URL when alimtalk env is absent but sender phone exists', async () => {
      const { service } = createService({
        SOLAPI_API_KEY: 'k',
        SOLAPI_API_SECRET: 's',
        SOLAPI_SENDER_PHONE: '0212345678',
      });

      await service.sendCheckoutNotification(checkoutData);

      expect(solapiSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '01012345678',
          from: '0212345678',
          type: 'LMS',
          text: expect.stringContaining(
            'https://www.lifeistravel.io/review/res_abc?token=tok',
          ),
        }),
      );
    });
  });

  describe('sendOwnerReviewPush', () => {
    const pushData = {
      storeId: 'store_1',
      reviewId: 'review_1',
      storeName: '테스트 매장',
      customerName: '홍*동',
      rating: 5,
      comment: '친절하고 위치도 좋았어요!',
    };

    it('skips silently when FIREBASE_SERVICE_ACCOUNT_JSON is not configured', async () => {
      const { service, prisma } = createService({});
      getFirebaseMessagingMock.mockReturnValue(null);

      await service.sendOwnerReviewPush(pushData);

      expect(prisma.owner_push_tokens.findMany).not.toHaveBeenCalled();
    });

    it('skips when the store has no registered tokens', async () => {
      const { service, prisma } = createService({
        FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
      });
      const sendMock = jest.fn();
      getFirebaseMessagingMock.mockReturnValue({
        sendEachForMulticast: sendMock,
      });
      prisma.owner_push_tokens.findMany.mockResolvedValue([]);

      await service.sendOwnerReviewPush(pushData);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('sends a multicast push with the comment preview and string data payload', async () => {
      const { service, prisma } = createService({
        FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
      });
      const sendMock = jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
      getFirebaseMessagingMock.mockReturnValue({
        sendEachForMulticast: sendMock,
      });
      prisma.owner_push_tokens.findMany.mockResolvedValue([{ token: 'tok-1' }]);

      await service.sendOwnerReviewPush(pushData);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['tok-1'],
          notification: {
            title: '새 리뷰가 도착했어요 ⭐5',
            body: '홍*동: 친절하고 위치도 좋았어요!',
          },
          data: {
            type: 'review_created',
            reviewId: 'review_1',
            storeId: 'store_1',
          },
        }),
      );
    });

    it('uses a rating-only body when the comment is empty', async () => {
      const { service, prisma } = createService({
        FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
      });
      const sendMock = jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
      getFirebaseMessagingMock.mockReturnValue({
        sendEachForMulticast: sendMock,
      });
      prisma.owner_push_tokens.findMany.mockResolvedValue([{ token: 'tok-1' }]);

      await service.sendOwnerReviewPush({ ...pushData, comment: '' });

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            body: '홍*동님이 별점 5점을 남겼어요',
          }),
        }),
      );
    });

    it('cleans up unregistered/invalid tokens from the DB', async () => {
      const { service, prisma } = createService({
        FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
      });
      getFirebaseMessagingMock.mockReturnValue({
        sendEachForMulticast: jest.fn().mockResolvedValue({
          successCount: 1,
          failureCount: 2,
          responses: [
            { success: true },
            {
              success: false,
              error: { code: 'messaging/registration-token-not-registered' },
            },
            {
              success: false,
              error: { code: 'messaging/invalid-registration-token' },
            },
          ],
        }),
      });
      prisma.owner_push_tokens.findMany.mockResolvedValue([
        { token: 'tok-good' },
        { token: 'tok-stale' },
        { token: 'tok-bad' },
      ]);

      await service.sendOwnerReviewPush(pushData);

      expect(prisma.owner_push_tokens.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['tok-stale', 'tok-bad'] } },
      });
    });

    it('does not delete tokens for transient (non-token) errors', async () => {
      const { service, prisma } = createService({
        FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
      });
      getFirebaseMessagingMock.mockReturnValue({
        sendEachForMulticast: jest.fn().mockResolvedValue({
          successCount: 0,
          failureCount: 1,
          responses: [
            { success: false, error: { code: 'messaging/internal-error' } },
          ],
        }),
      });
      prisma.owner_push_tokens.findMany.mockResolvedValue([{ token: 'tok-1' }]);

      await service.sendOwnerReviewPush(pushData);

      expect(prisma.owner_push_tokens.deleteMany).not.toHaveBeenCalled();
    });
  });
});
