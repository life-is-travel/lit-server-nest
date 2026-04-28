import {
  BadRequestException,
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
import { CouponAutoIssueService } from '../../coupons/services/coupon-auto-issue.service';
import { RELEASE_STORAGE_STATUSES } from '../reservation.constants';
import {
  CreateCustomerReservationDto,
  CreateReservationDto,
  ReservationResponseDto,
  ReservationStatusResponseDto,
  StoreCheckinDto,
} from '../dto/reservation.dto';
import { toReservationResponse } from '../mappers/reservation.mapper';
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

    const reservation = await this.prisma.reservations.create({
      data: {
        id: `res_${randomUUID()}`,
        store_id: storeId,
        customer_id: dto.customerId ?? `cust_${Date.now()}`,
        customer_name: dto.customerName,
        customer_phone: dto.phoneNumber,
        customer_email: dto.email ?? null,
        requested_storage_type: dto.storageType,
        status: reservations_status.pending,
        start_time: startTime,
        end_time: endTime,
        request_time: dto.requestTime ? new Date(dto.requestTime) : new Date(),
        duration: dto.duration,
        bag_count: dto.bagCount,
        total_amount: dto.price ?? 0,
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

    return toReservationResponse(reservation);
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

    await this.assertStoreExists(dto.storeId);

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

    const reservation = await this.prisma.reservations.create({
      data: {
        id: `res_${randomUUID()}`,
        store_id: dto.storeId,
        customer_id: customerId,
        customer_name: dto.customerName,
        customer_phone: dto.phoneNumber,
        customer_email: dto.email ?? null,
        requested_storage_type: dto.storageType,
        status: reservations_status.pending,
        start_time: startTime,
        end_time: endTime,
        request_time: dto.requestTime ? new Date(dto.requestTime) : new Date(),
        duration: dto.duration,
        bag_count: dto.bagCount,
        total_amount: dto.price ?? 0,
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

    return toReservationResponse(reservation);
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

      return {
        id: reservation.id,
        status: reservations_status.confirmed,
        storageId: storage.id,
        storageNumber: storage.number,
      };
    });
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

      this.reservationStatusService.assertCanTransition(
        reservation.status,
        nextStatus,
      );

      await tx.reservations.update({
        where: { id: reservation.id },
        data: {
          status: nextStatus,
          ...(nextStatus === reservations_status.in_progress
            ? { actual_start_time: reservation.actual_start_time ?? new Date() }
            : {}),
          ...(nextStatus === reservations_status.completed
            ? { actual_end_time: reservation.actual_end_time ?? new Date() }
            : {}),
          updated_at: new Date(),
        },
      });

      if (RELEASE_STORAGE_STATUSES.includes(nextStatus)) {
        await this.reservationStorageService.releaseStorageIfAny(
          tx,
          reservation.storage_id,
        );
      }

      return {
        id: reservation.id,
        status: nextStatus,
      };
    });
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

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private mergePhotoUrls(existing: Prisma.JsonValue | null, newUrls: string[]) {
    const current = Array.isArray(existing)
      ? existing.filter((value): value is string => typeof value === 'string')
      : [];

    return [...current, ...newUrls];
  }

  private async assertStoreExists(storeId: string): Promise<void> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }
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
      .catch((error: unknown) => {
        this.logger.warn(
          `checkin coupon auto issue failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
  }
}
