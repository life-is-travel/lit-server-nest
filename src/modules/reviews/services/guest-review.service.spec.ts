/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prisma, reservations_status } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { GuestReviewService } from './guest-review.service';

const createService = (config: Record<string, string> = {}) => {
  const prisma = {
    reservations: { findFirst: jest.fn() },
    reviews: { findFirst: jest.fn(), create: jest.fn() },
    stores: {
      findFirst: jest.fn().mockResolvedValue({ business_name: '테스트 매장' }),
    },
  };
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService;
  const notificationsService = {
    sendReviewCreatedNotification: jest.fn().mockResolvedValue(undefined),
    sendOwnerReviewPush: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new GuestReviewService(
      prisma as never,
      configService,
      notificationsService as never,
    ),
    prisma,
    notificationsService,
  };
};

const completedReservation = {
  id: 'res_1',
  store_id: 'store_1',
  customer_id: 'guest_01012345678_1',
  customer_name: '홍길동',
  status: reservations_status.completed,
  actual_end_time: new Date(Date.now() - 24 * 60 * 60 * 1000),
  qr_code: 'guest-token',
  reservation_group_id: 'res_1',
};

const validDto = {
  reservationId: 'res_1',
  token: 'guest-token',
  rating: 5,
  comment: '친절하고 위치도 좋았어요!',
  photoUrls: [] as string[],
};

describe('GuestReviewService.createReview', () => {
  it('creates a masked review for a completed owner-confirmed reservation', async () => {
    const { service, prisma, notificationsService } = createService();
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);
    prisma.reviews.findFirst.mockResolvedValue(null);
    prisma.reviews.create.mockImplementation(({ data }: never) =>
      Promise.resolve(data),
    );

    const result = await service.createReview(validDto);

    expect(prisma.reviews.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        store_id: 'store_1',
        reservation_id: 'res_1',
        customer_name: '홍*동',
        rating: 5,
        type: 'store',
        status: 'pending',
      }),
    });
    expect(result.customerName).toBe('홍*동');
    expect(
      notificationsService.sendReviewCreatedNotification,
    ).toHaveBeenCalled();
  });

  it('fires the owner FCM push hook in parallel with the Discord notification', async () => {
    const { service, prisma, notificationsService } = createService();
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);
    prisma.reviews.findFirst.mockResolvedValue(null);
    prisma.reviews.create.mockImplementation(({ data }: never) =>
      Promise.resolve(data),
    );

    const result = await service.createReview(validDto);

    expect(notificationsService.sendOwnerReviewPush).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store_1',
        reviewId: result.id,
        storeName: '테스트 매장',
        customerName: '홍*동',
        rating: 5,
        comment: validDto.comment,
      }),
    );
  });

  it('rejects a wrong token with 401', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);

    await expect(
      service.createReview({ ...validDto, token: 'wrong' }),
    ).rejects.toMatchObject({ response: { code: 'UNAUTHORIZED' } });
  });

  it('rejects when the reservation was auto-completed (no actual_end_time)', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue({
      ...completedReservation,
      actual_end_time: null,
    });

    await expect(service.createReview(validDto)).rejects.toMatchObject({
      response: { code: 'REVIEW_NOT_ELIGIBLE' },
    });
  });

  it('rejects a non-completed reservation', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue({
      ...completedReservation,
      status: reservations_status.in_progress,
    });

    await expect(service.createReview(validDto)).rejects.toMatchObject({
      response: { code: 'REVIEW_NOT_ELIGIBLE' },
    });
  });

  it('rejects after the 14-day window', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue({
      ...completedReservation,
      actual_end_time: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    });

    await expect(service.createReview(validDto)).rejects.toMatchObject({
      response: { code: 'REVIEW_WINDOW_EXPIRED' },
    });
  });

  it('rejects a duplicate review for the same group', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);
    prisma.reviews.findFirst.mockResolvedValue({ id: 'review_existing' });

    await expect(service.createReview(validDto)).rejects.toMatchObject({
      response: { code: 'REVIEW_ALREADY_EXISTS' },
    });
  });

  it('rejects photo URLs outside the R2 public domain', async () => {
    const { service, prisma } = createService({
      CF_R2_PUBLIC_URL: 'https://pub-test.r2.dev',
    });
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);
    prisma.reviews.findFirst.mockResolvedValue(null);

    await expect(
      service.createReview({
        ...validDto,
        photoUrls: ['https://evil.example.com/x.jpg'],
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_PHOTO_URL' } });
  });

  it('accepts photos under the R2 public domain', async () => {
    const { service, prisma } = createService({
      CF_R2_PUBLIC_URL: 'https://pub-test.r2.dev',
    });
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);
    prisma.reviews.findFirst.mockResolvedValue(null);
    prisma.reviews.create.mockImplementation(({ data }: never) =>
      Promise.resolve(data),
    );

    const result = await service.createReview({
      ...validDto,
      photoUrls: ['https://pub-test.r2.dev/reviews/store_1/a.jpg'],
    });

    expect(result.photoUrls).toEqual([
      'https://pub-test.r2.dev/reviews/store_1/a.jpg',
    ]);
  });

  it('returns 404 when the reservation does not exist', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue(null);

    await expect(service.createReview(validDto)).rejects.toMatchObject({
      response: { code: 'RESERVATION_NOT_FOUND' },
    });
  });

  it('converts a P2002 unique-constraint race into REVIEW_ALREADY_EXISTS', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue(completedReservation);
    prisma.reviews.findFirst.mockResolvedValue(null);
    prisma.reviews.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.createReview(validDto)).rejects.toMatchObject({
      response: { code: 'REVIEW_ALREADY_EXISTS' },
    });
  });

  it('normalizes a member id to the group representative for dedup', async () => {
    const { service, prisma } = createService();
    prisma.reservations.findFirst.mockResolvedValue({
      ...completedReservation,
      id: 'res_member',
      reservation_group_id: 'res_1',
    });
    prisma.reviews.findFirst.mockResolvedValue(null);
    prisma.reviews.create.mockImplementation(({ data }: never) =>
      Promise.resolve(data),
    );

    await service.createReview({ ...validDto, reservationId: 'res_member' });

    expect(prisma.reviews.findFirst).toHaveBeenCalledWith({
      where: { reservation_id: 'res_1' },
    });
    expect(prisma.reviews.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reservation_id: 'res_1' }),
    });
  });
});
