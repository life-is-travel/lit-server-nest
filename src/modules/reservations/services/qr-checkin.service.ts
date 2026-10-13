import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  coupon_policies_auto_issue_on,
  coupons_status,
  Prisma,
  reservations_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { CouponAutoIssueService } from '../../coupons/services/coupon-auto-issue.service';
import {
  QrCheckinDto,
  QrCheckinResponseDto,
  QrCheckoutDto,
  QrCheckoutResponseDto,
} from '../dto/qr-checkin.dto';
import { ReservationStatusService } from './reservation-status.service';
import { ReservationStorageService } from './reservation-storage.service';

@Injectable()
export class QrCheckinService {
  private readonly logger = new Logger(QrCheckinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationStatusService: ReservationStatusService,
    private readonly reservationStorageService: ReservationStorageService,
    private readonly couponAutoIssueService: CouponAutoIssueService,
  ) {}

  async checkinByToken(
    storeId: string,
    dto: QrCheckinDto,
  ): Promise<QrCheckinResponseDto> {
    const reservation = await this.findByToken(storeId, dto.token);

    this.reservationStatusService.assertCanCheckin(reservation.status);

    const photos = this.mergePhotoUrls(
      reservation.luggage_image_urls,
      dto.photoUrls ?? [],
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.reservations.update({
        where: { id: reservation.id },
        data: {
          status: reservations_status.in_progress,
          actual_start_time: reservation.actual_start_time ?? new Date(),
          luggage_image_urls: photos.length ? photos : Prisma.JsonNull,
          updated_at: new Date(),
        },
      });
      await this.reservationStorageService.occupyStorageIfAny(
        tx,
        reservation.storage_id,
      );
    });

    const issuedCouponIds = await this.issueCheckinCouponsSafely({
      customerId: reservation.customer_id,
      phoneNumber: reservation.customer_phone,
      storeId: reservation.store_id,
      reservationId: reservation.id,
    });

    this.logger.log({
      event: 'reservation.qr_checkin_completed',
      reservationId: reservation.id,
      storeId,
      issuedCouponCount: issuedCouponIds.length,
    });

    return {
      reservationId: reservation.id,
      status: reservations_status.in_progress,
      customerName: reservation.customer_name,
      customerPhone: reservation.customer_phone,
      bagCount: reservation.bag_count,
      storageType: reservation.requested_storage_type,
      storageNumber: reservation.storage_number,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      issuedCouponCount: issuedCouponIds.length,
    };
  }

  async checkoutByToken(
    storeId: string,
    dto: QrCheckoutDto,
  ): Promise<QrCheckoutResponseDto> {
    const reservation = await this.findByToken(storeId, dto.token);

    this.reservationStatusService.assertCanCheckout(reservation.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.reservations.update({
        where: { id: reservation.id },
        data: {
          status: reservations_status.completed,
          actual_end_time: reservation.actual_end_time ?? new Date(),
          updated_at: new Date(),
        },
      });

      await this.reservationStorageService.releaseStorageIfAny(
        tx,
        reservation.storage_id,
      );
    });

    // 고객의 미사용 쿠폰 존재 여부 확인
    const hasUnusedCoupon = await this.hasActiveCoupon(
      reservation.customer_id,
      reservation.customer_phone,
      storeId,
    );

    this.logger.log({
      event: 'reservation.qr_checkout_completed',
      reservationId: reservation.id,
      storeId,
      hasUnusedCoupon,
    });

    return {
      reservationId: reservation.id,
      status: reservations_status.completed,
      hasUnusedCoupon,
    };
  }

  private async findByToken(storeId: string, token: string) {
    if (!token) {
      throw new UnauthorizedException({
        code: 'TOKEN_REQUIRED',
        message: 'QR 토큰이 필요합니다.',
      });
    }

    const reservation = await this.prisma.reservations.findFirst({
      where: {
        store_id: storeId,
        qr_code: token,
      },
    });

    if (!reservation) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: '해당 QR 코드로 예약을 찾을 수 없습니다.',
      });
    }

    return reservation;
  }

  private async hasActiveCoupon(
    customerId: string | null,
    phoneNumber: string,
    storeId: string,
  ): Promise<boolean> {
    const isRegistered = !!customerId && customerId.startsWith('customer_');

    const count = await this.prisma.coupons.count({
      where: {
        status: coupons_status.active,
        store_id: storeId,
        ...(isRegistered
          ? { customer_id: customerId }
          : { phone_snapshot: phoneNumber }),
      },
    });

    return count > 0;
  }

  private async issueCheckinCouponsSafely(context: {
    customerId: string | null;
    phoneNumber: string;
    storeId: string;
    reservationId: string;
  }): Promise<string[]> {
    const isRegistered =
      !!context.customerId && context.customerId.startsWith('customer_');

    return this.couponAutoIssueService
      .issueForTrigger({
        customerId: isRegistered ? context.customerId : null,
        phoneSnapshot: isRegistered ? null : context.phoneNumber,
        storeId: context.storeId,
        trigger: coupon_policies_auto_issue_on.checkin_completed,
        reservationId: context.reservationId,
      })
      .catch((error: unknown) => {
        this.logger.warn({
          event: 'coupon.auto_issue_failed',
          err: error,
          reservationId: context.reservationId,
          storeId: context.storeId,
        });
        return [];
      });
  }

  private mergePhotoUrls(
    existing: Prisma.JsonValue | null,
    newUrls: string[],
  ): string[] {
    const current = Array.isArray(existing)
      ? existing.filter((v): v is string => typeof v === 'string')
      : [];
    return [...current, ...newUrls];
  }
}
