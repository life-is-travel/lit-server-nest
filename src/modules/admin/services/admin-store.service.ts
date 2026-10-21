import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, store_status_status } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';

/** 관리자 화면에 노출하는 매장 컬럼. password_hash 등 민감 컬럼은 제외한다. */
export const ADMIN_STORE_SELECT = {
  id: true,
  business_name: true,
  email: true,
  // 로그인 이메일은 점주 계정에 있다(F-026). 앱에서 추가한 매장은 stores.email이 NULL
  owners: { select: { email: true } },
  business_type: true,
  business_number: true,
  representative_name: true,
  address: true,
  phone_number: true,
  store_phone_number: true,
  has_completed_setup: true,
  created_at: true,
  last_login_at: true,
} satisfies Prisma.storesSelect;

export type AdminStoreRecord = Prisma.storesGetPayload<{
  select: typeof ADMIN_STORE_SELECT;
}>;

export type StoreStatusMap = Map<string, store_status_status>;

@Injectable()
export class AdminStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreOrThrow(storeId: string): Promise<AdminStoreRecord> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: ADMIN_STORE_SELECT,
    });

    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    return store;
  }

  /**
   * 매장별 최신 영업 상태(store_status는 이력 테이블이라 updated_at desc 첫 행).
   * 행이 없는 매장은 맵에 들어가지 않으며 resolveStatus가 closed로 해석한다.
   */
  async getLatestStatuses(storeIds: string[]): Promise<StoreStatusMap> {
    const statuses: StoreStatusMap = new Map();

    if (storeIds.length === 0) {
      return statuses;
    }

    const rows = await this.prisma.store_status.findMany({
      where: { store_id: { in: storeIds } },
      orderBy: { updated_at: 'desc' },
      select: { store_id: true, status: true },
    });

    for (const row of rows) {
      if (!statuses.has(row.store_id)) {
        statuses.set(row.store_id, row.status);
      }
    }

    return statuses;
  }

  static resolveStatus(
    statuses: StoreStatusMap,
    storeId: string,
  ): store_status_status {
    return statuses.get(storeId) ?? store_status_status.closed;
  }
}
