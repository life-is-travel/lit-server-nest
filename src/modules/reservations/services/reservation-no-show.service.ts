import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, reservations, reservations_status } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { NO_SHOW_FROM_STATUSES } from '../reservation.constants';
import { ReservationStorageService } from './reservation-storage.service';

export interface NoShowResult {
  id: string;
  status: reservations_status;
  updatedCount: number;
}

/**
 * 노쇼 전이의 단일 구현.
 *
 * 점주가 노쇼를 누르는 입구는 두 개다 — 알림톡 링크(HMAC 토큰)와 매장 앱(로그인 토큰).
 * 인증만 다르고 전이 규칙(시작 시각 경과·그룹 일괄·보관함 반납)은 같아야 하므로
 * 두 경로가 이 서비스를 공유한다.
 */
@Injectable()
export class ReservationNoShowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationStorageService: ReservationStorageService,
  ) {}

  /**
   * [reservationId]가 속한 예약 그룹 전체를 노쇼로 전이하고 보관함을 반납한다.
   *
   * [storeId]를 주면 그 매장 소유 예약만 대상으로 한다(매장 앱 경로의 소유권 검증).
   * 알림톡 경로는 토큰이 예약 ID에 묶여 있어 매장 범위를 따로 받지 않는다.
   */
  async markNoShow(
    reservationId: string,
    options: { storeId?: string } = {},
  ): Promise<NoShowResult> {
    return this.prisma.$transaction(async (tx) => {
      const { representative, members } = await this.resolveGroup(
        tx,
        reservationId,
        options.storeId,
      );

      // 빠른 실패 + details 제공용 사전 검사 (최종 방어선은 아래 CAS)
      const blocked = members.filter(
        (member) =>
          !member.status || !NO_SHOW_FROM_STATUSES.includes(member.status),
      );
      if (blocked.length) {
        throw new ConflictException({
          code: 'INVALID_TRANSITION',
          message: '현재 상태에서는 처리할 수 없습니다.',
          details: {
            currentStatus: representative.status,
            allowedFrom: NO_SHOW_FROM_STATUSES,
          },
        });
      }

      if (representative.start_time.getTime() > Date.now()) {
        throw new ConflictException({
          code: 'TOO_EARLY_FOR_NO_SHOW',
          message: '보관 시작 시각 이전에는 노쇼 처리할 수 없습니다.',
        });
      }

      // compare-and-swap: 조회 후 다른 요청이 상태를 바꿨다면(TOCTOU)
      // status 필터에 걸려 count가 모자라고, 전이 전체를 거부한다
      const updated = await tx.reservations.updateMany({
        where: {
          id: { in: members.map((member) => member.id) },
          status: { in: NO_SHOW_FROM_STATUSES },
        },
        data: {
          status: reservations_status.no_show,
          updated_at: new Date(),
        },
      });
      if (updated.count !== members.length) {
        throw new ConflictException({
          code: 'INVALID_TRANSITION',
          message: '현재 상태에서는 처리할 수 없습니다.',
        });
      }

      for (const member of members) {
        await this.reservationStorageService.releaseStorageIfAny(
          tx,
          member.storage_id,
        );
      }

      return {
        id: representative.id,
        status: reservations_status.no_show,
        updatedCount: members.length,
      };
    });
  }

  private async resolveGroup(
    client: Prisma.TransactionClient,
    reservationId: string,
    storeId?: string,
  ): Promise<{ representative: reservations; members: reservations[] }> {
    const storeScope = storeId ? { store_id: storeId } : {};

    const reservation = await client.reservations.findFirst({
      where: { id: reservationId, ...storeScope },
    });
    if (!reservation) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: '예약을 찾을 수 없습니다.',
      });
    }

    const members = reservation.reservation_group_id
      ? await client.reservations.findMany({
          where: {
            reservation_group_id: reservation.reservation_group_id,
            ...storeScope,
          },
        })
      : [reservation];

    const representative =
      members.find((member) => member.id === member.reservation_group_id) ??
      reservation;

    return { representative, members };
  }
}
