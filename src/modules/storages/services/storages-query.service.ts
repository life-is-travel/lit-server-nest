import { Injectable } from '@nestjs/common';
import { Prisma, reservations_status } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { ListStoragesQueryDto } from '../dto/list-storages-query.dto';
import { StorageListResponseDto, StorageResponseDto } from '../dto/storage.dto';
import { toStorageResponse } from '../mappers/storage.mapper';
import { StoragePolicyService } from './storage-policy.service';

const ACTIVE_STORAGE_RESERVATION_STATUSES = [
  reservations_status.confirmed,
  reservations_status.in_progress,
];

@Injectable()
export class StoragesQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storagePolicyService: StoragePolicyService,
  ) {}

  async listStorages(
    storeId: string,
    query: ListStoragesQueryDto,
  ): Promise<StorageListResponseDto> {
    await this.storagePolicyService.assertStoreExists(storeId);

    const page = query.page;
    const limit = query.limit;
    const where: Prisma.storagesWhereInput = {
      store_id: storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [totalItems, storages] = await Promise.all([
      this.prisma.storages.count({ where }),
      this.prisma.storages.findMany({
        where,
        orderBy: [{ type: 'asc' }, { number: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.currentReservationInclude(),
      }),
    ]);

    return {
      storages: storages.map(toStorageResponse),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
      },
    };
  }

  async getStorage(
    storeId: string,
    storageId: string,
  ): Promise<StorageResponseDto> {
    const storage = await this.prisma.storages.findFirst({
      where: {
        id: storageId,
        store_id: storeId,
      },
      include: this.currentReservationInclude(),
    });

    if (!storage) {
      await this.storagePolicyService.getStorageOrThrow(storageId, storeId);
    }

    return toStorageResponse(storage!);
  }

  private currentReservationInclude() {
    return {
      reservations: {
        where: {
          status: { in: ACTIVE_STORAGE_RESERVATION_STATUSES },
        },
        orderBy: {
          start_time: 'desc' as const,
        },
        take: 1,
      },
    };
  }
}
