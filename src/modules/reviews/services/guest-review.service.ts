import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, reservations_status } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/database/prisma.service';
import { maskCustomerName } from '../../../common/transformers/mask-name.util';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  CreateGuestReviewDto,
  GuestReviewResponseDto,
} from '../dto/guest-review.dto';

const REVIEW_WINDOW_DAYS = 14;

@Injectable()
export class GuestReviewService {
  private readonly logger = new Logger(GuestReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReview(
    dto: CreateGuestReviewDto,
  ): Promise<GuestReviewResponseDto> {
    const { reservationId, token, rating } = dto;
    // 텍스트 리뷰 선택 — 미입력 시 빈 문자열로 저장 (reviews.comment NOT NULL)
    const comment = dto.comment ?? '';
    // 매장 서비스·할인 별점 (선택) — 미이용 시 NULL
    const serviceRating = dto.serviceRating ?? null;
    const photoUrls = dto.photoUrls ?? [];

    // Step 1: 예약 조회 (404)
    const reservation = await this.prisma.reservations.findFirst({
      where: { id: reservationId },
    });
    if (!reservation) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: '예약을 찾을 수 없습니다.',
      });
    }

    // Step 1: 토큰 검증 (401)
    if (reservation.qr_code !== token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '유효하지 않은 토큰입니다.',
      });
    }

    // Step 2: status === completed 검증 (409)
    if (reservation.status !== reservations_status.completed) {
      throw new ConflictException({
        code: 'REVIEW_NOT_ELIGIBLE',
        message: '완료된 예약만 리뷰를 작성할 수 있습니다.',
      });
    }

    // Step 3: actual_end_time 없으면 자동완료 건 (409)
    if (!reservation.actual_end_time) {
      throw new ConflictException({
        code: 'REVIEW_NOT_ELIGIBLE',
        message: '점주 체크아웃 확인된 예약만 리뷰를 작성할 수 있습니다.',
      });
    }

    // Step 4: 14일 초과 (410)
    const windowMs = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - reservation.actual_end_time.getTime() > windowMs) {
      throw new GoneException({
        code: 'REVIEW_WINDOW_EXPIRED',
        message: '리뷰 작성 기간(14일)이 만료되었습니다.',
      });
    }

    // Step 5: 대표 ID 정규화 + 중복 검증
    const representativeId = reservation.reservation_group_id ?? reservation.id;
    const existing = await this.prisma.reviews.findFirst({
      where: { reservation_id: representativeId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'REVIEW_ALREADY_EXISTS',
        message: '이미 리뷰를 작성하셨습니다.',
      });
    }

    // 사진 URL 검증
    const validatedPhotoUrls = this.validatePhotoUrls(photoUrls);

    // 리뷰 저장
    const maskedName = maskCustomerName(reservation.customer_name ?? '');
    let review: GuestReviewResponseDto;
    try {
      const created = await this.prisma.reviews.create({
        data: {
          id: `review_${randomUUID()}`,
          store_id: reservation.store_id,
          customer_id: reservation.customer_id ?? '',
          reservation_id: representativeId,
          customer_name: maskedName,
          rating,
          service_rating: serviceRating,
          comment,
          type: 'store',
          status: 'pending',
          images: validatedPhotoUrls,
        },
      });

      review = {
        id: created.id,
        customerName: created.customer_name,
        rating: created.rating,
        serviceRating: created.service_rating,
        comment: created.comment,
        photoUrls: (created.images as string[]) ?? [],
      };
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'REVIEW_ALREADY_EXISTS',
          message: '이미 리뷰를 작성하셨습니다.',
        });
      }
      throw err;
    }

    // 매장명 조회 후 Discord 알림 + 점주 FCM 푸시 병렬 발송 (fire-and-forget).
    // 어떤 채널이 실패해도 고객 리뷰 응답에는 전파되지 않는다.
    this.prisma.stores
      .findFirst({ where: { id: reservation.store_id } })
      .then(async (store) => {
        const storeName = store?.business_name ?? '(알 수 없음)';
        const results = await Promise.allSettled([
          this.notificationsService.sendReviewCreatedNotification({
            reviewId: review.id,
            storeName,
            customerName: maskedName,
            rating,
            comment,
            photoUrls: validatedPhotoUrls,
          }),
          this.notificationsService.sendOwnerReviewPush({
            storeId: reservation.store_id,
            reviewId: review.id,
            storeName,
            customerName: maskedName,
            rating,
            comment,
          }),
        ]);
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            this.logger.error({
              event: 'reviews.notification_failed',
              channel: index === 0 ? 'discord' : 'owner_push',
              reviewId: review.id,
              err: result.reason as unknown,
            });
          }
        });
      })
      .catch((err: unknown) => {
        this.logger.error({
          event: 'reviews.notification_failed',
          reviewId: review.id,
          err,
        });
      });

    return review;
  }

  private validatePhotoUrls(urls: string[]): string[] {
    if (urls.length === 0) return [];

    const r2BaseRaw = this.configService.get<string>('CF_R2_PUBLIC_URL');
    if (!r2BaseRaw) {
      throw new BadRequestException({
        code: 'INVALID_PHOTO_URL',
        message: '사진 업로드가 현재 지원되지 않습니다.',
      });
    }

    const base = r2BaseRaw.replace(/\/$/, '');
    for (const url of urls) {
      if (!url.startsWith(`${base}/`)) {
        throw new BadRequestException({
          code: 'INVALID_PHOTO_URL',
          message: '허용되지 않은 사진 URL입니다.',
        });
      }
    }

    return urls;
  }
}
