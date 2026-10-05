import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  coupon_policies_auto_issue_on,
  Prisma,
  reservations_payment_status,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/database/prisma.service';
import { MailService } from '../../auth/services/mail.service';
import { CouponAutoIssueService } from '../../coupons/services/coupon-auto-issue.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  normalizeReservationLocale,
  RELEASE_STORAGE_STATUSES,
} from '../reservation.constants';
import {
  CreateCustomerReservationDto,
  CreateReservationDto,
  ReservationResponseDto,
  ReservationStatusResponseDto,
  StoreCheckinDto,
} from '../dto/reservation.dto';
import { toReservationResponse } from '../mappers/reservation.mapper';
import { normalizeStorageAssignmentType } from '../pricing/reservation-pricing.constants';
import { ReservationPricingService } from '../pricing/reservation-pricing.service';
import { ReservationQueryService } from './reservation-query.service';
import { ReservationStatusService } from './reservation-status.service';
import { ReservationStorageService } from './reservation-storage.service';

@Injectable()
export class ReservationCommandService {
  private readonly logger = new Logger(ReservationCommandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationQueryService: ReservationQueryService,
    private readonly reservationStatusService: ReservationStatusService,
    private readonly reservationStorageService: ReservationStorageService,
    private readonly couponAutoIssueService: CouponAutoIssueService,
    private readonly reservationPricingService: ReservationPricingService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createStoreReservation(
    authenticatedStoreId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const storeId = authenticatedStoreId || dto.storeId;

    if (!storeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '필수 정보가 누락되었습니다.',
        details: { required: ['storeId'] },
      });
    }

    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : this.addHours(startTime, dto.duration);

    if (endTime <= startTime) {
      throw new BadRequestException({
        code: 'INVALID_RESERVATION_TIME',
        message: '예약 종료 시간은 시작 시간보다 늦어야 합니다.',
      });
    }

    const storageType = normalizeStorageAssignmentType(dto.storageType);
    const totalAmount = this.reservationPricingService.calculateTotalAmount({
      storageType,
      bagCount: dto.bagCount,
      startTime,
      endTime,
    });

    const reservationId = `res_${randomUUID()}`;
    const reservation = await this.prisma.reservations.create({
      data: {
        id: reservationId,
        reservation_group_id: reservationId,
        store_id: storeId,
        customer_id: dto.customerId ?? `cust_${Date.now()}`,
        customer_name: dto.customerName,
        customer_phone: dto.phoneNumber,
        customer_email: dto.email ?? null,
        locale: normalizeReservationLocale(dto.locale),
        requested_storage_type: storageType,
        status: reservations_status.pending,
        start_time: startTime,
        end_time: endTime,
        request_time: dto.requestTime ? new Date(dto.requestTime) : new Date(),
        duration: dto.duration,
        bag_count: dto.bagCount,
        total_amount: totalAmount,
        message: dto.message ?? null,
        special_requests: dto.specialRequests ?? null,
        luggage_image_urls: dto.luggageImageUrls ?? Prisma.JsonNull,
        payment_status: reservations_payment_status.pending,
        payment_method: dto.paymentMethod ?? 'card',
        qr_code: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    this.logger.log({
      event: 'reservation.created',
      source: 'store',
      reservationId: reservation.id,
      storeId: reservation.store_id,
      customerId: reservation.customer_id,
      status: reservation.status,
    });

    await this.autoApproveAfterCreate(storeId, reservation.id);
    const finalReservation =
      await this.reloadReservationOrFallback(reservation);

    await this.sendReservationCreatedEmailSafely({
      reservation: finalReservation,
      storeName: null,
    });

    return toReservationResponse(finalReservation);
  }

  async createCustomerReservation(
    customerId: string,
    dto: CreateCustomerReservationDto,
  ): Promise<ReservationResponseDto> {
    if (!dto.storeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '필수 정보가 누락되었습니다.',
        details: { required: ['storeId'] },
      });
    }

    const store = await this.assertStoreExists(dto.storeId);

    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : this.addHours(startTime, dto.duration);

    if (endTime <= startTime) {
      throw new BadRequestException({
        code: 'INVALID_RESERVATION_TIME',
        message: '예약 종료 시간은 시작 시간보다 늦어야 합니다.',
      });
    }

    const storageType = normalizeStorageAssignmentType(dto.storageType);
    const totalAmount = this.reservationPricingService.calculateTotalAmount({
      storageType,
      bagCount: dto.bagCount,
      startTime,
      endTime,
    });

    const reservationId = `res_${randomUUID()}`;
    const reservation = await this.prisma.reservations.create({
      data: {
        id: reservationId,
        reservation_group_id: reservationId,
        store_id: dto.storeId,
        customer_id: customerId,
        customer_name: dto.customerName,
        customer_phone: dto.phoneNumber,
        customer_email: dto.email ?? null,
        locale: normalizeReservationLocale(dto.locale),
        requested_storage_type: storageType,
        status: reservations_status.pending,
        start_time: startTime,
        end_time: endTime,
        request_time: dto.requestTime ? new Date(dto.requestTime) : new Date(),
        duration: dto.duration,
        bag_count: dto.bagCount,
        total_amount: totalAmount,
        message: dto.message ?? null,
        special_requests: dto.specialRequests ?? null,
        luggage_image_urls: dto.luggageImageUrls ?? Prisma.JsonNull,
        payment_status: reservations_payment_status.pending,
        payment_method: dto.paymentMethod ?? 'card',
        qr_code: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    this.logger.log({
      event: 'reservation.created',
      source: 'customer',
      reservationId: reservation.id,
      storeId: reservation.store_id,
      customerId: reservation.customer_id,
      status: reservation.status,
    });

    await this.autoApproveAfterCreate(dto.storeId, reservation.id);
    const finalReservation =
      await this.reloadReservationOrFallback(reservation);

    await this.sendReservationCreatedEmailSafely({
      reservation: finalReservation,
      storeName: store.business_name,
    });

    return toReservationResponse(finalReservation);
  }

  async approveReservation(
    storeId: string,
    reservationId: string,
  ): Promise<ReservationStatusResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservations.findFirst({
        where: {
          id: reservationId,
          store_id: storeId,
        },
      });

      if (!reservation) {
        throw this.reservationQueryService.reservationNotFound();
      }

      this.reservationStatusService.assertCanApprove(reservation.status);

      if (!reservation.requested_storage_type) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '요청 보관함 타입이 없는 예약은 승인할 수 없습니다.',
        });
      }

      const storage = reservation.storage_id
        ? {
            id: reservation.storage_id,
            number: reservation.storage_number,
          }
        : await this.reservationStorageService.assignAvailableStorage(tx, {
            storeId,
            startTime: reservation.start_time,
            endTime: reservation.end_time,
            storageType: reservation.requested_storage_type,
          });

      if (reservation.storage_id) {
        await tx.storages.update({
          where: { id: reservation.storage_id },
          data: {
            status: storages_status.occupied,
            updated_at: new Date(),
          },
        });
      }

      await tx.reservations.update({
        where: { id: reservation.id },
        data: {
          status: reservations_status.confirmed,
          storage_id: storage.id,
          storage_number: storage.number,
          confirmed_at: reservation.confirmed_at ?? new Date(),
          updated_at: new Date(),
        },
      });

      this.logger.log({
        event: 'reservation.status_changed',
        reservationId: reservation.id,
        storeId,
        previousStatus: reservation.status,
        nextStatus: reservations_status.confirmed,
        storageId: storage.id,
      });

      return {
        id: reservation.id,
        status: reservations_status.confirmed,
        storageId: storage.id,
        storageNumber: storage.number,
      };
    });
  }

  // 예약 생성 직후 자동 승인한다. 가용 보관함이 없으면(NO_AVAILABLE_STORAGE)
  // 예약을 pending으로 남기고 생성 흐름을 막지 않는다.
  private async autoApproveAfterCreate(
    storeId: string,
    reservationId: string,
  ): Promise<void> {
    try {
      await this.approveReservation(storeId, reservationId);
    } catch (error) {
      if (
        error instanceof ConflictException &&
        (error.getResponse() as { code?: string })?.code ===
          'NO_AVAILABLE_STORAGE'
      ) {
        this.logger.warn({
          event: 'reservation.auto_approve_skipped',
          reason: 'NO_AVAILABLE_STORAGE',
          reservationId,
          storeId,
        });
        return;
      }

      throw error;
    }
  }

  // 자동 승인으로 status/보관함이 바뀌었을 수 있으므로 최신 행을 다시 읽어 응답한다.
  private async reloadReservationOrFallback<T extends { id: string }>(
    fallback: T,
  ): Promise<T> {
    const latest = await this.prisma.reservations.findUnique({
      where: { id: fallback.id },
    });

    return (latest as T | null) ?? fallback;
  }

  async rejectReservation(
    storeId: string,
    reservationId: string,
  ): Promise<ReservationStatusResponseDto> {
    return this.updateReservationStatus(
      storeId,
      reservationId,
      reservations_status.rejected,
    );
  }

  async cancelReservation(
    storeId: string,
    reservationId: string,
  ): Promise<ReservationStatusResponseDto> {
    return this.updateReservationStatus(
      storeId,
      reservationId,
      reservations_status.cancelled,
    );
  }

  async updateReservationStatus(
    storeId: string,
    reservationId: string,
    nextStatus: reservations_status,
  ): Promise<ReservationStatusResponseDto> {
    if (nextStatus === reservations_status.confirmed) {
      return this.approveReservation(storeId, reservationId);
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const found = await tx.reservations.findFirst({
        where: {
          id: reservationId,
          store_id: storeId,
        },
      });

      if (!found) {
        throw this.reservationQueryService.reservationNotFound();
      }

      this.reservationStatusService.assertCanTransition(
        found.status,
        nextStatus,
      );

      await tx.reservations.update({
        where: { id: found.id },
        data: {
          status: nextStatus,
          ...(nextStatus === reservations_status.in_progress
            ? { actual_start_time: found.actual_start_time ?? new Date() }
            : {}),
          ...(nextStatus === reservations_status.completed
            ? { actual_end_time: found.actual_end_time ?? new Date() }
            : {}),
          updated_at: new Date(),
        },
      });

      if (RELEASE_STORAGE_STATUSES.includes(nextStatus)) {
        await this.reservationStorageService.releaseStorageIfAny(
          tx,
          found.storage_id,
        );
      }

      this.logger.log({
        event: 'reservation.status_changed',
        reservationId: found.id,
        storeId,
        previousStatus: found.status,
        nextStatus,
      });

      return found;
    });

    // 점주앱 체크아웃(QR·수동 공통 경로) → 고객 리뷰 요청 fan-out.
    // 트랜잭션 커밋 후에만 발송하고, 실제로 completed로 "전환"된 경우로
    // 한정한다 — 동일 상태 재요청(멱등 성공)에 재발송하지 않기 위함.
    if (
      nextStatus === reservations_status.completed &&
      reservation.status !== reservations_status.completed
    ) {
      this.notificationsService.notifyCheckoutReview(reservation);
    }

    return {
      id: reservation.id,
      status: nextStatus,
    };
  }

  async storeCheckin(
    storeId: string,
    reservationId: string,
    dto: StoreCheckinDto,
  ): Promise<ReservationStatusResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservations.findFirst({
        where: {
          id: reservationId,
          store_id: storeId,
        },
      });

      if (!reservation) {
        throw this.reservationQueryService.reservationNotFound();
      }

      this.reservationStatusService.assertCanCheckin(reservation.status);

      const photos = this.mergePhotoUrls(
        reservation.luggage_image_urls,
        dto.photoUrls ?? [],
      );

      await tx.reservations.update({
        where: { id: reservation.id },
        data: {
          status: reservations_status.in_progress,
          actual_start_time: reservation.actual_start_time ?? new Date(),
          luggage_image_urls: photos.length ? photos : Prisma.JsonNull,
          updated_at: new Date(),
        },
      });

      return {
        id: reservation.id,
        status: reservations_status.in_progress,
        photos,
        couponIssueContext: {
          customerId: reservation.customer_id,
          phoneNumber: reservation.customer_phone,
          storeId: reservation.store_id,
          reservationId: reservation.id,
        },
      };
    });

    await this.issueCheckinCouponsSafely(result.couponIssueContext);

    this.logger.log({
      event: 'reservation.checkin_completed',
      reservationId: result.id,
      storeId,
    });

    const { couponIssueContext, ...response } = result;
    void couponIssueContext;

    return response;
  }

  async customerCheckout(
    customerId: string,
    reservationId: string,
  ): Promise<ReservationStatusResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservations.findFirst({
        where: {
          id: reservationId,
          customer_id: customerId,
        },
      });

      if (!reservation) {
        throw this.reservationQueryService.reservationNotFound();
      }

      this.reservationStatusService.assertCanCheckout(reservation.status);

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

      return {
        id: reservation.id,
        status: reservations_status.completed,
      };
    });
  }

  normalizeStatus(status: string): reservations_status {
    return this.reservationStatusService.normalizeStatus(status);
  }

  /**
   * 점주가 짐 확인 후 남기는 메모를 저장한다.
   * store_id로 소유권을 검증(다른 매장 예약은 수정 불가).
   */
  async setLuggageOwnerMemo(
    storeId: string,
    reservationId: string,
    memo: string,
  ): Promise<{ success: true }> {
    const result = await this.prisma.reservations.updateMany({
      where: { id: reservationId, store_id: storeId },
      data: { luggage_owner_memo: memo, updated_at: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: '예약을 찾을 수 없습니다.',
      });
    }
    return { success: true };
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private mergePhotoUrls(existing: Prisma.JsonValue | null, newUrls: string[]) {
    const current = Array.isArray(existing)
      ? existing.filter((value): value is string => typeof value === 'string')
      : [];

    return [...current, ...newUrls];
  }

  private async assertStoreExists(
    storeId: string,
  ): Promise<{ id: string; business_name: string }> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true, business_name: true, closed_at: true },
    });

    // 탈퇴한 매장(closed_at)에는 예약을 만들 수 없다.
    if (!store || store.closed_at) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    return { id: store.id, business_name: store.business_name };
  }

  private async sendReservationCreatedEmailSafely(params: {
    reservation: {
      id: string;
      customer_email: string | null;
      customer_name: string;
      store_id: string;
      start_time: Date;
      end_time: Date | null;
      bag_count: number;
      total_amount: number;
      locale: string | null;
      qr_code?: string | null;
    };
    storeName: string | null;
  }): Promise<void> {
    if (!params.reservation.customer_email) {
      return;
    }

    await this.mailService
      .sendReservationCreatedEmail(params.reservation.customer_email, {
        reservationId: params.reservation.id,
        customerName: params.reservation.customer_name,
        storeName: params.storeName,
        locale: params.reservation.locale,
        startTime: params.reservation.start_time,
        endTime: params.reservation.end_time,
        bagCount: params.reservation.bag_count,
        totalAmount: params.reservation.total_amount,
        accessToken: params.reservation.qr_code,
      })
      .catch((error: unknown) => {
        this.logger.warn({
          event: 'reservation.email_failed',
          err: error,
          reservationId: params.reservation.id,
          storeId: params.reservation.store_id,
          email: params.reservation.customer_email,
        });
      });
  }

  private async issueCheckinCouponsSafely(context: {
    customerId: string | null;
    phoneNumber: string;
    storeId: string;
    reservationId: string;
  }): Promise<void> {
    const isRegisteredCustomer =
      !!context.customerId && context.customerId.startsWith('customer_');

    await this.couponAutoIssueService
      .issueForTrigger({
        customerId: isRegisteredCustomer ? context.customerId : null,
        phoneSnapshot: isRegisteredCustomer ? null : context.phoneNumber,
        storeId: context.storeId,
        trigger: coupon_policies_auto_issue_on.checkin_completed,
        reservationId: context.reservationId,
      })
      .then((couponIds) => {
        if (couponIds.length > 0) {
          this.logger.log({
            event: 'coupon.auto_issue_completed',
            reservationId: context.reservationId,
            storeId: context.storeId,
            issuedCount: couponIds.length,
            couponIds,
          });
        }
      })
      .catch((error: unknown) => {
        this.logger.warn({
          event: 'coupon.auto_issue_failed',
          err: error,
          reservationId: context.reservationId,
          storeId: context.storeId,
        });
      });
  }
}
