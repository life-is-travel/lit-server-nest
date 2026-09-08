/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import {
  CancelNotificationData,
  CreateNotificationData,
  NotificationsService,
} from './notifications.service';

const solapiSendMock = jest.fn().mockResolvedValue(undefined);
jest.mock('solapi', () => ({
  SolapiMessageService: jest.fn().mockImplementation(() => ({
    send: solapiSendMock,
  })),
}));

const createService = (config: Record<string, string>) => {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService;
  const mailService = {
    sendReviewRequestEmail: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    stores: {
      findFirst: jest.fn().mockResolvedValue({ business_name: '테스트 매장' }),
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
    expect(ownerCall?.[0].kakaoOptions?.variables?.['#{store_name}']).toBe(
      '테스트 매장',
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

  it('normalizes owner recipients (strips hidden chars/spaces) before sending', async () => {
    const { service } = createService({
      SOLAPI_API_KEY: 'k',
      SOLAPI_API_SECRET: 's',
      SOLAPI_KAKAO_PF_ID: 'pf',
      SOLAPI_KAKAO_TEMPLATE_ID: 'tmpl',
    });

    await service.sendCreateNotification({
      ...createData,
      // 대시·국가코드가 섞인 원본 → 정규화된 숫자만 to로 나가야 한다
      ownerPhone: '010-9999-8888',
      additionalOwnerPhones: ['+82-010-1111-2222'],
    });

    type SolapiSendArg = {
      to?: string;
      kakaoOptions?: { templateId?: string };
    };
    const ownerCalls = (solapiSendMock.mock.calls as [SolapiSendArg][]).filter(
      (call) => call[0]?.kakaoOptions?.templateId === 'tmpl',
    );
    // 원본이 아니라 정규화된 숫자만 to로 전달
    expect(ownerCalls.map((call) => call[0].to)).toEqual([
      '01099998888',
      '01011112222',
    ]);
  });

  it('warns and skips the owner create alimtalk when no valid recipient exists', async () => {
    const { service } = createService({
      SOLAPI_API_KEY: 'k',
      SOLAPI_API_SECRET: 's',
      SOLAPI_KAKAO_PF_ID: 'pf',
      SOLAPI_KAKAO_TEMPLATE_ID: 'tmpl',
    });
    const warnSpy = jest
      .spyOn(
        (
          service as unknown as {
            logger: { warn: (...args: unknown[]) => void };
          }
        ).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await service.sendCreateNotification({
      ...createData,
      ownerPhone: '',
      additionalOwnerPhones: [],
    });

    expect(solapiSendMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notifications.kakao_create_owner_skipped',
        reservationId: 'res_abc-123456',
        storeName: '테스트 매장',
      }),
    );
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

  describe('notifyCheckoutReview', () => {
    const flushAsync = () => new Promise(setImmediate);

    const reservationRow = {
      id: 'res_1',
      store_id: 'store_1',
      customer_name: '홍길동',
      customer_phone: '01012345678',
      customer_email: null,
      locale: 'ko',
      qr_code: 'guest-token',
    };

    it('assembles the review path and store name, then sends the checkout notification', async () => {
      const { service, prisma } = createService({});
      const sendSpy = jest
        .spyOn(service, 'sendCheckoutNotification')
        .mockResolvedValue(undefined);

      service.notifyCheckoutReview(reservationRow);
      await flushAsync();

      expect(prisma.stores.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'store_1' } }),
      );
      expect(sendSpy).toHaveBeenCalledWith({
        reservationId: 'res_1',
        storeName: '테스트 매장',
        customerName: '홍길동',
        customerPhone: '01012345678',
        customerEmail: null,
        locale: 'ko',
        reviewPath: 'www.lifeistravel.io/review/res_1?token=guest-token',
      });
    });

    it('prefixes the locale segment for non-Korean reservations', async () => {
      const { service } = createService({});
      const sendSpy = jest
        .spyOn(service, 'sendCheckoutNotification')
        .mockResolvedValue(undefined);

      service.notifyCheckoutReview({
        ...reservationRow,
        locale: 'en',
      });
      await flushAsync();

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewPath: 'www.lifeistravel.io/en/review/res_1?token=guest-token',
        }),
      );
    });

    it('skips sending when the reservation has no review token (qr_code)', async () => {
      const { service } = createService({});
      const sendSpy = jest
        .spyOn(service, 'sendCheckoutNotification')
        .mockResolvedValue(undefined);

      service.notifyCheckoutReview({
        ...reservationRow,
        qr_code: null,
      });
      await flushAsync();

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('absorbs send failures into an error log instead of throwing', async () => {
      const { service, errorSpy } = createService({});
      jest
        .spyOn(service, 'sendCheckoutNotification')
        .mockRejectedValue(new Error('solapi down'));

      service.notifyCheckoutReview(reservationRow);
      await flushAsync();

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
