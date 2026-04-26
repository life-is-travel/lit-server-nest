import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class DashboardStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreOrThrow(storeId: string) {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: {
        business_name: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!store) {
      throw this.storeNotFound();
    }

    return store;
  }

  async assertStoreExists(storeId: string): Promise<void> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!store) {
      throw this.storeNotFound();
    }
  }

  private storeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'STORE_NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }
}
