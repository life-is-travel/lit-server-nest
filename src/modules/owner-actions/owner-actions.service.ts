import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  reservations,
  reservations_payment_status,
  reservations_status,
} from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { ownerReservationDisplayLabel } from '../../common/transformers/owner-reservation-display.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationStorageService } from '../reservations/services/reservation-storage.service';
import {
  OwnerActionResultDto,
  OwnerReservationSummaryDto,
} from './dto/owner-action.dto';

// 점주의 물리적 확인(도착/픽업)은 승인 대기 상태보다 우선한다 —
// NO_AVAILABLE_STORAGE로 pending에 남은 멤버도 함께 전이
const CHECK_IN_FROM: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
];
// 점주의 물리적 확인(도착/픽업)은 승인 대기 상태보다 우선한다 —
// NO_AVAILABLE_STORAGE로 pending에 남은 멤버도 함께 전이
const CHECK_OUT_FROM: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
  reservations_status.in_progress,
];
// 점주의 물리적 확인(도착/픽업)은 승인 대기 상태보다 우선한다 —
// NO_AVAILABLE_STORAGE로 pending에 남은 멤버도 함께 전이
const NO_SHOW_FROM: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
];

@Injectable()
export class OwnerActionsService {
  private readonly logger = new Logger(OwnerActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationStorageService: ReservationStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSummary(reservationId: string): Promise<OwnerReservationSummaryDto> {
    const { representative, members } = await this.resolveGroup(
      this.prisma,
      reservationId,
    );
    return this.toSummary(representative, members);
  }

  async checkIn(reservationId: string): Promise<OwnerActionResultDto> {
    const { result } = await this.transitionInTx(
      reservationId,
      CHECK_IN_FROM,
      (rep) => ({
        status: reservations_status.in_progress,
        actual_start_time: new Date(),
        // 현장결제는 짐 인수(체크인) 시점에 결제 수령으로 간주 — 대시보드
        // 매출 집계(payment_status=paid 필터) 기준. 온라인 결제 건은 이미 paid.
        ...(rep.payment_status === reservations_payment_status.pending
          ? { payment_status: reservations_payment_status.paid }
          : {}),
        updated_at: new Date(),
      }),
      { releaseStorage: false },
    );
    return result;
  }

  async checkOut(reservationId: string): Promise<OwnerActionResultDto> {
    const now = new Date();

    const { result, representative } = await this.transitionInTx(
      reservationId,
      CHECK_OUT_FROM,
      (rep) => ({
        status: reservations_status.completed,
        actual_start_time: rep.actual_start_time ?? now,
        actual_end_time: now,
        // 체크인 생략 후 바로 체크아웃한 케이스도 현장결제 수령으로 간주.
        ...(rep.payment_status === reservations_payment_status.pending
          ? { payment_status: reservations_payment_status.paid }
          : {}),
        updated_at: now,
      }),
      { releaseStorage: true },
    );

    // 점주 직접 체크아웃 → 리뷰 요청 fan-out (fire-and-forget)
    this.notificationsService.notifyCheckoutReview(representative);

    return result;
  }

  async noShow(reservationId: string): Promise<OwnerActionResultDto> {
    const { result } = await this.transitionInTx(
      reservationId,
      NO_SHOW_FROM,
      (representative) => {
        if (representative.start_time.getTime() > Date.now()) {
          throw new ConflictException({
            code: 'TOO_EARLY_FOR_NO_SHOW',
            message: '보관 시작 시각 이전에는 노쇼 처리할 수 없습니다.',
          });
        }
        return {
          status: reservations_status.no_show,
          updated_at: new Date(),
        };
      },
      { releaseStorage: true },
    );
    return result;
  }

  private async transitionInTx(
    reservationId: string,
    allowedFrom: reservations_status[],
    buildData: (rep: reservations) => {
      status: reservations_status;
    } & Prisma.reservationsUpdateManyMutationInput,
    options: { releaseStorage: boolean },
  ): Promise<{ result: OwnerActionResultDto; representative: reservations }> {
    return this.prisma.$transaction(async (tx) => {
      const { representative, members } = await this.resolveGroup(
        tx,
        reservationId,
      );

      // 빠른 실패 + details 제공용 사전 검사 (최종 방어선은 아래 CAS)
      const blocked = members.filter(
        (member) => !member.status || !allowedFrom.includes(member.status),
      );
      if (blocked.length) {
        throw new ConflictException({
          code: 'INVALID_TRANSITION',
          message: '현재 상태에서는 처리할 수 없습니다.',
          details: {
            currentStatus: representative.status,
            allowedFrom,
          },
        });
      }

      const data = buildData(representative);

      // compare-and-swap: 조회 후 다른 요청이 상태를 바꿨다면(TOCTOU)
      // status 필터에 걸려 count가 모자라고, 전이 전체를 거부한다
      const updated = await tx.reservations.updateMany({
        where: {
          id: { in: members.map((member) => member.id) },
          status: { in: allowedFrom },
        },
        data,
      });
      if (updated.count !== members.length) {
        throw new ConflictException({
          code: 'INVALID_TRANSITION',
          message: '현재 상태에서는 처리할 수 없습니다.',
        });
      }

      if (options.releaseStorage) {
        for (const member of members) {
          await this.reservationStorageService.releaseStorageIfAny(
            tx,
            member.storage_id,
          );
        }
      }

      return {
        result: {
          id: representative.id,
          status: data.status,
          updatedCount: members.length,
        },
        representative,
      };
    });
  }

  private async resolveGroup(
    client: PrismaService | Prisma.TransactionClient,
    reservationId: string,
  ): Promise<{ representative: reservations; members: reservations[] }> {
    const reservation = await client.reservations.findFirst({
      where: { id: reservationId },
    });
    if (!reservation) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: '예약을 찾을 수 없습니다.',
      });
    }

    const members = reservation.reservation_group_id
      ? await client.reservations.findMany({
          where: { reservation_group_id: reservation.reservation_group_id },
        })
      : [reservation];

    const representative =
      members.find((member) => member.id === member.reservation_group_id) ??
      reservation;

    return { representative, members };
  }

  private toSummary(
    representative: reservations,
    members: reservations[],
  ): OwnerReservationSummaryDto {
    const phone = String(representative.customer_phone ?? '').trim();
    const email = String(representative.customer_email ?? '').trim();
    const customerContact = ownerReservationDisplayLabel({
      customerName: representative.customer_name,
      phone,
      email,
    });

    return {
      id: representative.id,
      status: String(representative.status),
      customerName: customerContact,
      phoneNumber: phone || null,
      email: email || null,
      items: members.map((member) => ({
        storageType: String(member.requested_storage_type ?? 's'),
        bagCount: member.bag_count,
      })),
      startTime: representative.start_time,
      endTime: representative.end_time,
      actualStartTime: representative.actual_start_time,
      actualEndTime: representative.actual_end_time,
      // 실제 noShow 허용 조건(NO_SHOW_FROM + start_time 경과)과 동일하게 판정
      canMarkNoShow:
        members.every(
          (member) => member.status && NO_SHOW_FROM.includes(member.status),
        ) && representative.start_time.getTime() <= Date.now(),
      locale: representative.locale ?? 'ko',
      // 짐 사진/메모는 그룹 대표 행에 저장됨 (예약 생성 시 index 0)
      luggageImageUrls: Array.isArray(representative.luggage_image_urls)
        ? (representative.luggage_image_urls as string[])
        : [],
      luggageCustomerMemo: representative.luggage_customer_memo,
      luggageOwnerMemo: representative.luggage_owner_memo,
    };
  }
}
