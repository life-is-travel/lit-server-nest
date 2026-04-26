import { Injectable, NotFoundException } from '@nestjs/common';
import { store_status_status } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { UpdateStoreStatusDto } from '../dto/store-status.dto';

type StoreStatusResponse = {
  storeId: string;
  status: store_status_status;
  reason: string | null;
  lastUpdated: Date | null;
};

@Injectable()
export class StoreStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(storeId: string): Promise<StoreStatusResponse> {
    await this.assertStoreExists(storeId);

    const status = await this.prisma.store_status.findFirst({
      where: { store_id: storeId },
      orderBy: { updated_at: 'desc' },
    });

    if (!status) {
      return {
        storeId,
        status: store_status_status.closed,
        reason: null,
        lastUpdated: null,
      };
    }

    return {
      storeId: status.store_id,
      status: status.status,
      reason: status.reason,
      lastUpdated: status.updated_at ?? status.created_at ?? null,
    };
  }

  async updateStatus(
    storeId: string,
    dto: UpdateStoreStatusDto,
  ): Promise<StoreStatusResponse> {
    await this.assertStoreExists(storeId);

    const updatedStatus = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.store_status.findFirst({
        where: { store_id: storeId },
        select: { id: true },
      });

      if (existing) {
        return tx.store_status.update({
          where: { id: existing.id },
          data: {
            status: dto.status,
            reason: dto.reason?.trim() ?? null,
            updated_at: new Date(),
          },
        });
      }

      return tx.store_status.create({
        data: {
          store_id: storeId,
          status: dto.status,
          reason: dto.reason?.trim() ?? null,
        },
      });
    });

    return {
      storeId: updatedStatus.store_id,
      status: updatedStatus.status,
      reason: updatedStatus.reason,
      lastUpdated: updatedStatus.updated_at ?? updatedStatus.created_at ?? null,
    };
  }

  openStore(storeId: string): Promise<StoreStatusResponse> {
    return this.updateStatus(storeId, {
      status: store_status_status.open,
    });
  }

  closeStore(storeId: string): Promise<StoreStatusResponse> {
    return this.updateStatus(storeId, {
      status: store_status_status.closed,
    });
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
}
