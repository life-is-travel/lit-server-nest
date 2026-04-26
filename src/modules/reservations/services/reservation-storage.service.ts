import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  reservations_requested_storage_type,
  storages_status,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { ACTIVE_RESERVATION_STATUSES } from '../reservation.constants';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class ReservationStorageService {
  constructor(private readonly prisma: PrismaService) {}

  async assignAvailableStorage(
    tx: TransactionClient,
    params: {
      storeId: string;
      startTime: Date;
      endTime: Date | null;
      storageType: reservations_requested_storage_type;
    },
  ) {
    const storage = await tx.storages.findFirst({
      where: {
        store_id: params.storeId,
        status: storages_status.available,
        type: params.storageType,
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

    if (!storage) {
      throw new ConflictException({
        code: 'NO_AVAILABLE_STORAGE',
        message: '해당 시간에 사용할 수 있는 보관함이 없습니다.',
        details: {
          storeId: params.storeId,
          startTime: params.startTime,
          endTime: params.endTime,
          storageType: params.storageType,
        },
      });
    }

    await tx.storages.update({
      where: { id: storage.id },
      data: {
        status: storages_status.occupied,
        updated_at: new Date(),
      },
    });

    return storage;
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
