import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  payments_status,
  Prisma,
  reservations_payment_status,
  reservations_requested_storage_type,
  reservations_status,
  storages_status,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../../common/database/prisma.service';
import { MailService } from '../../auth/services/mail.service';
import {
  CancelGuestReservationDto,
  CleanupExpiredGuestReservationsResponseDto,
  CreateGuestReservationDto,
  CreateGuestReservationResponseDto,
  GetGuestReservationQueryDto,
  GuestAvailabilityQueryDto,
  GuestAvailabilityResponseDto,
  GuestReservationCancelResponseDto,
  GuestReservationListResponseDto,
  GuestReservationResponseDto,
  ListGuestReservationsQueryDto,
  PatchLuggagePhotosDto,
  PatchLuggagePhotosResponseDto,
} from '../dto/guest-reservation.dto';
import {
  GuestReservationWithStore,
  toGuestReservationGroupResponse,
  toGuestReservationResponse,
  toGuestStoreName,
} from '../mappers/guest-reservation.mapper';
import { normalizeReservationLocale } from '../reservation.constants';
import { normalizeStorageAssignmentType } from '../pricing/reservation-pricing.constants';
import { ReservationPricingService } from '../pricing/reservation-pricing.service';
import { ReservationStorageService } from './reservation-storage.service';

const ALLOWED_STORAGE_TYPES = Object.values(
  reservations_requested_storage_type,
);
const RESERVATION_TTL_MINUTES = 30;
const GUEST_CANCEL_STATUSES: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
];
const CAPACITY_COUNT_STATUSES: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
  reservations_status.in_progress,
];

type NormalizedReservationItem = {
  storageType: reservations_requested_storage_type;
  bagCount: number;
};

type CapacityFailure = {
  storageType: reservations_requested_storage_type;
  maxCapacity: number;
  currentCount: number;
  requested: number;
};

const MAX_BAG_COUNT_PER_TYPE = 10;

@Injectable()
export class GuestReservationService {
  private readonly logger = new Logger(GuestReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationStorageService: ReservationStorageService,
    private readonly reservationPricingService: ReservationPricingService,
    private readonly mailService: MailService,
  ) {}

  async createReservation(
    dto: CreateGuestReservationDto,
  ): Promise<CreateGuestReservationResponseDto> {
    const items = this.normalizeItems(dto);
    const contact = this.resolveCreateContact(dto);
    const { phoneNumber, email } = contact;

    const store = await this.resolveStore(dto.storeId);
    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : this.addHours(startTime, dto.duration);

    this.assertValidTimeRange(startTime, endTime);

    this.assertCapacityAvailable(
      await this.checkCapacityBatch({
        storeId: store.id,
        items,
        startTime,
        endTime,
      }),
    );

    // 그룹 식별자는 대표 예약 id를 그대로 사용합니다 (id === group_id 행이 대표).
    const representativeId = `res_${randomUUID()}`;
    const groupId = representativeId;
    const customerId = `guest_${phoneNumber}_${Date.now()}`;
    const accessToken = this.generateAccessToken();
    const paymentKey = dto.paymentKey ?? dto.payment_key;
    const orderId = dto.orderId ?? dto.order_id;
    const locale = normalizeReservationLocale(dto.locale);
    const now = new Date();
    const amounts = items.map((item) =>
      this.reservationPricingService.calculateTotalAmount({
        storageType: item.storageType,
        bagCount: item.bagCount,
        startTime,
        endTime,
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      this.assertCapacityAvailable(
        await this.checkCapacityBatch(
          {
            storeId: store.id,
            items,
            startTime,
            endTime,
          },
          tx,
        ),
      );

      const payment = await this.findVerifiedPaymentIfProvided(
        tx,
        paymentKey,
        orderId,
      );

      await tx.reservations.createMany({
        data: items.map((item, index) => ({
          id: index === 0 ? representativeId : `res_${randomUUID()}`,
          store_id: store.id,
          customer_id: customerId,
          customer_name: dto.customerName,
          customer_phone: phoneNumber,
          customer_email: email,
          locale,
          requested_storage_type: item.storageType,
          status: reservations_status.pending,
          start_time: startTime,
          end_time: endTime,
          request_time: now,
          duration: dto.duration,
          bag_count: item.bagCount,
          total_amount: amounts[index],
          message: dto.message ?? null,
          special_requests: null,
          // cleanup(TTL 만료 취소)이 그룹을 반쪽만 취소하지 않도록
          // payment_status와 created_at은 그룹 전 행이 동일해야 합니다.
          payment_status: payment
            ? reservations_payment_status.paid
            : reservations_payment_status.pending,
          payment_method: 'card',
          payment_id: index === 0 ? (payment?.id ?? null) : null,
          qr_code: accessToken,
          reservation_group_id: groupId,
          created_at: now,
          updated_at: now,
        })),
      });

      if (payment) {
        const result = await tx.payments.updateMany({
          where: {
            id: payment.id,
            reservation_id: null,
          },
          data: {
            reservation_id: representativeId,
            updated_at: new Date(),
          },
        });

        if (result.count !== 1) {
          throw new ConflictException({
            code: 'PAYMENT_ALREADY_USED',
            message: '이 결제는 이미 다른 예약에 사용되었습니다.',
          });
        }
      }
    });

    await this.autoApproveGroup(groupId);

    const reservation = await this.getGuestReservationGroupOrThrow(
      groupId,
      true,
    );

    await this.sendReservationCreatedEmailSafely(reservation);

    return {
      reservation,
      storeName: toGuestStoreName(store),
    };
  }

  // 생성된 그룹의 각 pending 행을 자동 승인한다. 타입별 가용 보관함이 없으면
  // 해당 행만 pending으로 남기고(NO_AVAILABLE_STORAGE) 나머지는 계속 승인한다.
  private async autoApproveGroup(groupId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.reservations.findMany({
        where: {
          reservation_group_id: groupId,
          status: reservations_status.pending,
        },
      });

      for (const row of rows) {
        if (!row.requested_storage_type) {
          continue;
        }

        try {
          const storage =
            await this.reservationStorageService.assignAvailableStorage(tx, {
              storeId: row.store_id,
              startTime: row.start_time,
              endTime: row.end_time,
              storageType: row.requested_storage_type,
            });

          await tx.reservations.update({
            where: { id: row.id },
            data: {
              status: reservations_status.confirmed,
              storage_id: storage.id,
              storage_number: storage.number,
              confirmed_at: row.confirmed_at ?? new Date(),
              updated_at: new Date(),
            },
          });
        } catch (error) {
          if (
            error instanceof ConflictException &&
            (error.getResponse() as { code?: string })?.code ===
              'NO_AVAILABLE_STORAGE'
          ) {
            this.logger.warn({
              event: 'guest_reservation.auto_approve_skipped',
              reason: 'NO_AVAILABLE_STORAGE',
              reservationId: row.id,
              storeId: row.store_id,
            });
            continue;
          }

          throw error;
        }
      }
    });
  }

  private normalizeItems(
    dto: CreateGuestReservationDto,
  ): NormalizedReservationItem[] {
    if (!dto.items?.length) {
      if (!dto.bagCount) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'bagCount 또는 items가 필요합니다.',
          details: { required: ['bagCount', 'items'] },
        });
      }

      return [
        {
          storageType: normalizeStorageAssignmentType(
            dto.storageType ??
              dto.requestedStorageType ??
              reservations_requested_storage_type.s,
          ),
          bagCount: dto.bagCount,
        },
      ];
    }

    // normalize(xl/special→l) 후 같은 타입은 합산 머지합니다. 입력 순서를 유지합니다.
    const merged = new Map<reservations_requested_storage_type, number>();

    for (const item of dto.items) {
      const storageType = normalizeStorageAssignmentType(item.storageType);
      merged.set(storageType, (merged.get(storageType) ?? 0) + item.bagCount);
    }

    for (const [storageType, bagCount] of merged) {
      if (bagCount > MAX_BAG_COUNT_PER_TYPE) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '타입별 가방 수는 최대 10개입니다.',
          details: {
            storageType,
            merged: bagCount,
            max: MAX_BAG_COUNT_PER_TYPE,
          },
        });
      }
    }

    return [...merged].map(([storageType, bagCount]) => ({
      storageType,
      bagCount,
    }));
  }

  private assertCapacityAvailable(failures: CapacityFailure[]): void {
    if (failures.length) {
      throw new ConflictException({
        code: 'CAPACITY_EXCEEDED',
        message: '해당 시간대에 수용 가능한 공간이 부족합니다.',
        details: {
          maxCapacity: failures[0].maxCapacity,
          currentCount: failures[0].currentCount,
          requested: failures[0].requested,
          failures,
        },
      });
    }
  }

  async listReservations(
    query: ListGuestReservationsQueryDto,
  ): Promise<GuestReservationListResponseDto> {
    const contact = this.resolveListContact(query);

    const reservations = await this.prisma.reservations.findMany({
      where: contact.email
        ? {
            OR: [
              { customer_email: contact.email },
              { customer_phone: contact.email },
            ],
          }
        : { customer_phone: contact.phoneNumber },
      orderBy: { created_at: 'desc' },
      include: this.guestStoreInclude(),
    });

    const items = this.groupReservations(reservations).map((rows) =>
      toGuestReservationGroupResponse(rows),
    );

    return {
      items,
      total: items.length,
    };
  }

  // created_at desc로 정렬된 행을 그룹 단위(레거시 NULL 행은 자기 자신 1건)로 묶습니다.
  private groupReservations(
    reservations: GuestReservationWithStore[],
  ): GuestReservationWithStore[][] {
    const groups = new Map<string, GuestReservationWithStore[]>();

    for (const reservation of reservations) {
      const key = reservation.reservation_group_id ?? reservation.id;
      const group = groups.get(key);

      if (group) {
        group.push(reservation);
      } else {
        groups.set(key, [reservation]);
      }
    }

    return [...groups.values()];
  }

  async getReservation(
    reservationId: string,
    query: GetGuestReservationQueryDto,
  ): Promise<GuestReservationResponseDto> {
    if (!query.token) {
      throw new UnauthorizedException({
        code: 'TOKEN_REQUIRED',
        message: '예약 조회에는 토큰이 필요합니다.',
      });
    }

    const reservation = await this.prisma.reservations.findFirst({
      where: {
        id: reservationId,
        qr_code: query.token,
      },
      include: this.guestStoreInclude(),
    });

    if (!reservation) {
      throw this.reservationNotFound();
    }

    // 그룹 멤버 id 어떤 것으로 조회해도 그룹 전체를 머지해 응답합니다.
    if (!reservation.reservation_group_id) {
      return toGuestReservationResponse(reservation);
    }

    const groupRows = await this.prisma.reservations.findMany({
      where: {
        reservation_group_id: reservation.reservation_group_id,
        qr_code: query.token,
      },
      include: this.guestStoreInclude(),
    });

    return toGuestReservationGroupResponse(
      groupRows.length ? groupRows : [reservation],
    );
  }

  async cleanupExpiredReservations(): Promise<CleanupExpiredGuestReservationsResponseDto> {
    const cutoff = new Date(Date.now() - RESERVATION_TTL_MINUTES * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 자동 승인(confirmed)된 미결제 예약도 TTL 대상이다. 보관함을 점유 중일 수
      // 있으므로 취소 전에 점유 보관함을 모아 반납한다.
      const expiring = await tx.reservations.findMany({
        where: {
          status: {
            in: [reservations_status.pending, reservations_status.confirmed],
          },
          payment_status: reservations_payment_status.pending,
          customer_id: { startsWith: 'guest_' },
          created_at: { lt: cutoff },
        },
        select: { id: true, storage_id: true },
      });

      if (!expiring.length) {
        return {
          cancelledCount: 0,
          ttlMinutes: RESERVATION_TTL_MINUTES,
        };
      }

      const storageIds = [
        ...new Set(
          expiring
            .map((row) => row.storage_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      if (storageIds.length) {
        await tx.storages.updateMany({
          where: { id: { in: storageIds } },
          data: {
            status: storages_status.available,
            updated_at: new Date(),
          },
        });
      }

      const result = await tx.reservations.updateMany({
        where: { id: { in: expiring.map((row) => row.id) } },
        data: {
          status: reservations_status.cancelled,
          updated_at: new Date(),
        },
      });

      return {
        cancelledCount: result.count,
        ttlMinutes: RESERVATION_TTL_MINUTES,
      };
    });
  }

  async cancelReservation(
    reservationId: string,
    dto: CancelGuestReservationDto,
  ): Promise<GuestReservationCancelResponseDto> {
    const contact = this.resolveCancelContact(dto);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservations.findFirst({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw this.reservationNotFound();
      }

      if (!this.matchesGuestContact(reservation, contact)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '본인 예약만 취소할 수 있습니다.',
        });
      }

      // 부분 취소(부분 환불)는 지원하지 않으므로 그룹 전체를 한 번에 취소합니다.
      const members = reservation.reservation_group_id
        ? await tx.reservations.findMany({
            where: {
              reservation_group_id: reservation.reservation_group_id,
            },
          })
        : [reservation];

      const blockedItems = members.filter(
        (member) =>
          !member.status || !GUEST_CANCEL_STATUSES.includes(member.status),
      );

      if (blockedItems.length) {
        throw new ConflictException({
          code: 'NOT_CANCELLABLE',
          message: '현재 상태에서는 취소할 수 없습니다.',
          details: {
            currentStatus: reservation.status,
            blockedItems: blockedItems.map((member) => ({
              id: member.id,
              storageType: member.requested_storage_type,
              status: member.status,
            })),
          },
        });
      }

      if (reservation.start_time.getTime() <= Date.now()) {
        throw new ConflictException({
          code: 'TOO_LATE_TO_CANCEL',
          message: '이미 시작된 예약은 취소할 수 없습니다.',
          details: { startTime: reservation.start_time },
        });
      }

      await tx.reservations.updateMany({
        where: { id: { in: members.map((member) => member.id) } },
        data: {
          status: reservations_status.cancelled,
          updated_at: new Date(),
        },
      });

      for (const member of members) {
        await this.reservationStorageService.releaseStorageIfAny(
          tx,
          member.storage_id,
        );
      }

      const representative =
        members.find((member) => member.id === member.reservation_group_id) ??
        reservation;

      return {
        id: representative.id,
        status: reservations_status.cancelled,
        groupId: reservation.reservation_group_id ?? reservation.id,
        cancelledCount: members.length,
      };
    });
  }

  async getAvailability(
    query: GuestAvailabilityQueryDto,
  ): Promise<GuestAvailabilityResponseDto> {
    const store = await this.resolveStore(query.storeId);
    const startTime = new Date(query.startTime);
    const endTime = this.addHours(startTime, query.duration);

    this.assertValidTimeRange(startTime, endTime);

    // 설정은 한 번만 조회하고, 예약 수량은 storage type 기준으로 한 번에 집계합니다.
    const [settings, aggregated] = await Promise.all([
      this.prisma.store_settings.findUnique({
        where: { store_id: store.id },
      }),
      this.prisma.reservations.groupBy({
        by: ['requested_storage_type'],
        where: {
          store_id: store.id,
          requested_storage_type: { in: ALLOWED_STORAGE_TYPES },
          status: { in: CAPACITY_COUNT_STATUSES },
          payment_status: { not: reservations_payment_status.refunded },
          start_time: { lt: endTime },
          end_time: { gt: startTime },
        },
        _sum: { bag_count: true },
      }),
    ]);
    const countByType = new Map<reservations_requested_storage_type, number>();

    for (const row of aggregated) {
      if (row.requested_storage_type) {
        countByType.set(row.requested_storage_type, row._sum.bag_count ?? 0);
      }
    }

    const items: GuestAvailabilityResponseDto['items'] = {};

    for (const storageType of ALLOWED_STORAGE_TYPES) {
      const maxCapacity = this.getMaxCapacity(settings, storageType);
      const currentCount = countByType.get(storageType) ?? 0;

      items[storageType] = {
        maxCapacity,
        currentCount,
        remaining: Math.max(0, maxCapacity - currentCount),
      };
    }

    return {
      storeId: query.storeId,
      startTime: query.startTime,
      endTime: endTime.toISOString(),
      duration: query.duration,
      items,
    };
  }

  async saveLuggagePhotos(
    reservationId: string,
    dto: PatchLuggagePhotosDto,
  ): Promise<PatchLuggagePhotosResponseDto> {
    const reservation = await this.prisma.reservations.findFirst({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw this.reservationNotFound();
    }

    // 전화번호 또는 이메일 중 하나로 본인 확인
    const hasPhone = Boolean(dto.customerPhone?.trim());
    const hasEmail = Boolean(dto.customerEmail?.trim());

    if (!hasPhone && !hasEmail) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '본인 확인을 위해 customerPhone 또는 customerEmail이 필요합니다.',
      });
    }

    const contact = hasEmail
      ? { email: this.normalizeEmail(dto.customerEmail) }
      : { phoneNumber: this.normalizePhone(dto.customerPhone) };

    if (!this.matchesGuestContact(reservation, contact)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '본인 예약에만 사진을 추가할 수 있습니다.',
      });
    }

    // 예약 생성 후 24시간 이내인지 확인
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const createdAt = reservation.created_at;

    if (createdAt && Date.now() - createdAt.getTime() > TWENTY_FOUR_HOURS_MS) {
      throw new BadRequestException({
        code: 'PHOTO_UPLOAD_WINDOW_EXPIRED',
        message: '예약 생성 후 24시간 이내에만 짐 사진을 등록할 수 있습니다.',
      });
    }

    // 기존 URL과 새 URL 병합 (최대 10개)
    const MAX_PHOTOS = 10;
    const existing = Array.isArray(reservation.luggage_image_urls)
      ? (reservation.luggage_image_urls as string[])
      : [];
    const merged = [...existing, ...dto.photoUrls].slice(0, MAX_PHOTOS);

    await this.prisma.reservations.update({
      where: { id: reservationId },
      data: {
        luggage_image_urls: merged,
        updated_at: new Date(),
      },
    });

    this.logger.log({
      event: 'guest_reservation.luggage_photos_saved',
      reservationId,
      count: merged.length,
    });

    return { id: reservationId, luggageImageUrls: merged };
  }

  normalizePhone(phone?: string | null): string {
    return String(phone ?? '').replace(/[-\s]/g, '');
  }

  private normalizeEmail(email?: string | null): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
  }

  private isEmailAddress(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private resolveCreateContact(dto: CreateGuestReservationDto): {
    phoneNumber: string;
    email: string | null;
  } {
    const rawPhone = String(dto.phoneNumber ?? '').trim();
    const explicitEmail = this.normalizeEmail(
      dto.email ?? dto.customerEmail ?? null,
    );

    if (this.isEmailAddress(rawPhone)) {
      const email = explicitEmail || this.normalizeEmail(rawPhone);
      this.assertValidEmail(email);
      return { phoneNumber: email, email };
    }

    const phoneNumber = this.normalizePhone(rawPhone);
    this.assertValidPhone(phoneNumber);
    return { phoneNumber, email: explicitEmail || null };
  }

  private resolveListContact(query: ListGuestReservationsQueryDto): {
    phoneNumber?: string;
    email?: string;
  } {
    const email = this.normalizeEmail(query.email);
    if (email) {
      this.assertValidEmail(email);
      return { email };
    }

    const phoneNumber = this.normalizePhone(
      query.phoneNumber ?? query.customer_phone,
    );
    if (!phoneNumber) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '전화번호 또는 이메일이 필요합니다.',
        details: { required: ['phoneNumber', 'email'] },
      });
    }

    if (this.isEmailAddress(phoneNumber)) {
      this.assertValidEmail(phoneNumber);
      return { email: this.normalizeEmail(phoneNumber) };
    }

    this.assertValidPhone(phoneNumber);
    return { phoneNumber };
  }

  private resolveCancelContact(dto: CancelGuestReservationDto): {
    phoneNumber?: string;
    email?: string;
  } {
    const email = this.normalizeEmail(dto.email);
    if (email) {
      this.assertValidEmail(email);
      return { email };
    }

    const rawPhone = String(dto.phoneNumber ?? '').trim();
    if (!rawPhone) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '전화번호 또는 이메일이 필요합니다.',
        details: { required: ['phoneNumber', 'email'] },
      });
    }

    if (this.isEmailAddress(rawPhone)) {
      this.assertValidEmail(rawPhone);
      return { email: this.normalizeEmail(rawPhone) };
    }

    const phoneNumber = this.normalizePhone(rawPhone);
    this.assertValidPhone(phoneNumber);
    return { phoneNumber };
  }

  private matchesGuestContact(
    reservation: {
      customer_phone: string | null;
      customer_email: string | null;
    },
    contact: { phoneNumber?: string; email?: string },
  ): boolean {
    if (contact.email) {
      const normalized = contact.email;
      const reservationEmail = this.normalizeEmail(reservation.customer_email);
      const reservationPhone = String(reservation.customer_phone ?? '').trim();
      return (
        reservationEmail === normalized ||
        reservationPhone.toLowerCase() === normalized
      );
    }

    return (
      this.normalizePhone(reservation.customer_phone) === contact.phoneNumber
    );
  }

  private assertValidEmail(email: string): void {
    if (!this.isEmailAddress(email)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '올바른 이메일을 입력해주세요.',
      });
    }
  }

  private async resolveStore(idOrSlug: string) {
    const store = await this.prisma.stores.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      select: {
        id: true,
        business_name: true,
      },
    });

    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '매장을 찾을 수 없습니다.',
      });
    }

    return store;
  }

  // 타입 수와 무관하게 settings 1회 + groupBy 1회로 전 타입을 한 번에 체크합니다.
  private async checkCapacityBatch(
    params: {
      storeId: string;
      items: NormalizedReservationItem[];
      startTime: Date;
      endTime: Date;
    },
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<CapacityFailure[]> {
    const storageTypes = params.items.map((item) => item.storageType);
    const [settings, aggregated] = await Promise.all([
      client.store_settings.findUnique({
        where: { store_id: params.storeId },
      }),
      client.reservations.groupBy({
        by: ['requested_storage_type'],
        where: {
          store_id: params.storeId,
          requested_storage_type: { in: storageTypes },
          status: { in: CAPACITY_COUNT_STATUSES },
          payment_status: { not: reservations_payment_status.refunded },
          start_time: { lt: params.endTime },
          end_time: { gt: params.startTime },
        },
        _sum: { bag_count: true },
      }),
    ]);
    const countByType = new Map<reservations_requested_storage_type, number>();

    for (const row of aggregated) {
      if (row.requested_storage_type) {
        countByType.set(row.requested_storage_type, row._sum.bag_count ?? 0);
      }
    }

    const failures: CapacityFailure[] = [];

    for (const item of params.items) {
      const maxCapacity = this.getMaxCapacity(settings, item.storageType);
      const currentCount = countByType.get(item.storageType) ?? 0;

      if (currentCount + item.bagCount > maxCapacity) {
        failures.push({
          storageType: item.storageType,
          maxCapacity,
          currentCount,
          requested: item.bagCount,
        });
      }
    }

    return failures;
  }

  private getMaxCapacity(
    settings: Awaited<
      ReturnType<PrismaService['store_settings']['findUnique']>
    >,
    storageType: reservations_requested_storage_type,
  ): number {
    if (!settings) {
      return 5;
    }

    const billingType = normalizeStorageAssignmentType(storageType);
    const capacityMap: Record<
      reservations_requested_storage_type,
      number | null | undefined
    > = {
      [reservations_requested_storage_type.s]: settings.m_max_capacity,
      [reservations_requested_storage_type.m]: settings.l_max_capacity,
      [reservations_requested_storage_type.l]: settings.xl_max_capacity,
      [reservations_requested_storage_type.xl]: settings.xl_max_capacity,
      [reservations_requested_storage_type.special]: settings.xl_max_capacity,
      [reservations_requested_storage_type.refrigeration]:
        settings.refrigeration_max_capacity,
    };

    return capacityMap[billingType] ?? 5;
  }

  private async findVerifiedPaymentIfProvided(
    tx: Prisma.TransactionClient,
    paymentKey?: string,
    orderId?: string,
  ) {
    if (!paymentKey && !orderId) {
      return null;
    }

    if (!paymentKey || !orderId) {
      throw new BadRequestException({
        code: 'PAYMENT_INFO_INCOMPLETE',
        message: 'paymentKey와 orderId를 함께 전달해야 합니다.',
      });
    }

    const payment = await tx.payments.findFirst({
      where: {
        pg_payment_key: paymentKey,
        pg_order_id: orderId,
      },
      select: {
        id: true,
        status: true,
        reservation_id: true,
      },
    });

    if (!payment || payment.status !== payments_status.SUCCESS) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_VERIFIED',
        message: '결제가 확인되지 않았습니다. 결제 완료 후 다시 시도해주세요.',
      });
    }

    if (payment.reservation_id) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_USED',
        message: '이 결제는 이미 다른 예약에 사용되었습니다.',
      });
    }

    return payment;
  }

  private async getGuestReservationGroupOrThrow(
    groupId: string,
    includeAccessToken: boolean,
  ): Promise<GuestReservationResponseDto> {
    const rows = await this.prisma.reservations.findMany({
      where: { reservation_group_id: groupId },
      include: this.guestStoreInclude(),
    });

    if (!rows.length) {
      throw this.reservationNotFound();
    }

    return toGuestReservationGroupResponse(rows, { includeAccessToken });
  }

  private guestStoreInclude() {
    return {
      stores: {
        select: {
          business_name: true,
          address: true,
          phone_number: true,
          latitude: true,
          longitude: true,
        },
      },
    };
  }

  private generateAccessToken(): string {
    return randomBytes(16).toString('base64url');
  }

  private async sendReservationCreatedEmailSafely(
    reservation: GuestReservationResponseDto,
  ): Promise<void> {
    if (!reservation.email) {
      return;
    }

    await this.mailService
      .sendReservationCreatedEmail(reservation.email, {
        reservationId: reservation.id,
        customerName: reservation.customerName,
        storeName: reservation.storeName,
        locale: reservation.locale,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        bagCount: reservation.bagCount,
        totalAmount: reservation.totalAmount,
        accessToken: reservation.accessToken,
      })
      .catch((error: unknown) => {
        this.logger.warn({
          event: 'guest_reservation.email_failed',
          err: error,
          reservationId: reservation.id,
          storeId: reservation.storeId,
          email: reservation.email,
        });
      });
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private assertValidTimeRange(startTime: Date, endTime: Date): void {
    if (
      Number.isNaN(startTime.getTime()) ||
      Number.isNaN(endTime.getTime()) ||
      endTime <= startTime
    ) {
      throw new BadRequestException({
        code: 'INVALID_RESERVATION_TIME',
        message: '예약 시간이 올바르지 않습니다.',
      });
    }
  }

  private assertValidPhone(phoneNumber: string): void {
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '올바른 전화번호를 입력해주세요.',
      });
    }
  }

  private reservationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: '예약을 찾을 수 없습니다.',
    });
  }
}
