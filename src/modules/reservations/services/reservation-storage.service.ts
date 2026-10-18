import { Injectable } from '@nestjs/common';
import {
  Prisma,
  reservations_requested_storage_type,
  storages_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { normalizeStorageAssignmentType } from '../pricing/reservation-pricing.constants';
import { ACTIVE_RESERVATION_STATUSES } from '../reservation.constants';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class ReservationStorageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 예약 시간대에 비어 있는 보관함을 번호순으로 고른다(PRD F-004 보관함 배정 규칙).
   * 비어 있는지는 보관함의 현재 상태가 아니라 시간이 겹치는 활성 예약 유무로 판단하고,
   * 배정해도 상태는 바꾸지 않는다. 고를 보관함이 없으면 null — 판매 여부는 수용량 검사가
   * 이미 판단했으므로 호출부는 보관함 없이 예약을 확정한다.
   */
  async findStorageForReservation(
    tx: TransactionClient,
    params: {
      storeId: string;
      startTime: Date;
      endTime: Date | null;
      storageType: reservations_requested_storage_type;
    },
  ): Promise<{ id: string; number: string } | null> {
    return tx.storages.findFirst({
      where: {
        store_id: params.storeId,
        status: { not: storages_status.maintenance },
        type: normalizeStorageAssignmentType(params.storageType),
        reservations: {
          none: this.buildOverlappingReservationWhere(
            params.startTime,
            params.endTime,
          ),
        },
      },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
      },
    });
  }

  /** 체크인으로 짐이 실제로 들어간 보관함을 occupied로 바꾼다. 점검 중인 보관함은 건드리지 않는다. */
  async occupyStorageIfAny(
    tx: TransactionClient,
    storageId?: string | null,
  ): Promise<void> {
    if (!storageId) {
      return;
    }

    await tx.storages.updateMany({
      where: { id: storageId, status: storages_status.available },
      data: {
        status: storages_status.occupied,
        updated_at: new Date(),
      },
    });
  }

  async releaseStorageIfAny(
    tx: TransactionClient,
    storageId?: string | null,
  ): Promise<void> {
    if (!storageId) {
      return;
    }

    await tx.storages.update({
      where: { id: storageId },
      data: {
        status: storages_status.available,
        updated_at: new Date(),
      },
    });
  }

  private buildOverlappingReservationWhere(
    startTime: Date,
    endTime: Date | null,
  ): Prisma.reservationsWhereInput {
    return {
      status: { in: ACTIVE_RESERVATION_STATUSES },
      start_time: endTime ? { lt: endTime } : undefined,
      end_time: { gt: startTime },
    };
  }

  get client(): PrismaService {
    return this.prisma;
  }
}
