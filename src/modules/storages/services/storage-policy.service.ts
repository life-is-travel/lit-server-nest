import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { reservations_status, storages, storages_status } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';

const ACTIVE_STORAGE_RESERVATION_STATUSES = [
  reservations_status.confirmed,
  reservations_status.in_progress,
];

@Injectable()
export class StoragePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getStorageOrThrow(id: string, storeId: string): Promise<storages> {
    const storage = await this.prisma.storages.findFirst({
      where: { id, store_id: storeId },
    });

    if (!storage) {
      throw new NotFoundException({
        code: 'STORAGE_NOT_FOUND',
        message: '보관함을 찾을 수 없습니다.',
      });
    }

    return storage;
  }

  async assertStoreExists(storeId: string): Promise<void> {
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

  async assertStorageNumberAvailable(
    storeId: string,
    number: string,
    excludeStorageId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.storages.findFirst({
      where: {
        store_id: storeId,
        number,
        ...(excludeStorageId ? { id: { not: excludeStorageId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw this.duplicateStorageNumber(number);
    }
  }

  async assertCanDeleteOrDeactivate(storage: storages): Promise<void> {
    if (storage.status === storages_status.occupied) {
      throw this.storageInUse();
    }

    if (await this.hasActiveReservation(storage.id, storage.store_id)) {
      throw this.storageInUse();
    }
  }

  async assertCanUpdateStorage(
    storage: storages,
    changes: {
      number?: string;
      type?: unknown;
      status?: storages_status;
    },
  ): Promise<void> {
    if (changes.status === storages_status.occupied) {
      throw new BadRequestException({
        code: 'STORAGE_STATUS_MANAGED_BY_RESERVATION',
        message:
          'occupied 상태는 예약 승인/체크인 흐름에서만 변경할 수 있습니다.',
      });
    }

    const changesReservationSensitiveFields =
      changes.number !== undefined ||
      changes.type !== undefined ||
      changes.status !== undefined;

    if (!changesReservationSensitiveFields) {
      return;
    }

    if (
      storage.status === storages_status.occupied ||
      (await this.hasActiveReservation(storage.id, storage.store_id))
    ) {
      throw new BadRequestException({
        code: 'STORAGE_IN_USE',
        message:
          '진행 중인 예약이 연결된 보관함은 번호, 타입, 상태를 변경할 수 없습니다.',
      });
    }
  }

  duplicateStorageNumber(number: string): BadRequestException {
    return new BadRequestException({
      code: 'DUPLICATE_STORAGE_NUMBER',
      message: '이미 존재하는 보관함 번호입니다.',
      details: { number },
    });
  }

  private async hasActiveReservation(
    storageId: string,
    storeId: string,
  ): Promise<boolean> {
    const reservation = await this.prisma.reservations.findFirst({
      where: {
        storage_id: storageId,
        store_id: storeId,
        status: { in: ACTIVE_STORAGE_RESERVATION_STATUSES },
      },
      select: { id: true },
    });

    return Boolean(reservation);
  }

  private storageInUse(): BadRequestException {
    return new BadRequestException({
      code: 'STORAGE_IN_USE',
      message: '사용 중인 보관함은 삭제하거나 비활성화할 수 없습니다.',
    });
  }
}
