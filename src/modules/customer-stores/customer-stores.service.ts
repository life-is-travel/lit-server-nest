import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  CustomerStoreListResponseDto,
  CustomerStoreResponseDto,
  ListCustomerStoresQueryDto,
} from './dto/customer-store.dto';
import { toCustomerStoreResponse } from './mappers/customer-store.mapper';
import {
  CUSTOMER_STORE_DETAIL_SELECT,
  CUSTOMER_STORE_LIST_SELECT,
} from './services/customer-stores.select';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class CustomerStoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listStores(
    query: ListCustomerStoresQueryDto,
  ): Promise<CustomerStoreListResponseDto> {
    const limit = this.normalizeLimit(query.limit);
    const keyword = query.keyword?.trim();

    const stores = await this.prisma.stores.findMany({
      where: this.createListWhere(keyword),
      orderBy: { business_name: 'asc' },
      take: limit,
      select: CUSTOMER_STORE_LIST_SELECT,
    });

    return {
      items: stores.map(toCustomerStoreResponse),
    };
  }

  async getStoreDetail(storeId: string): Promise<CustomerStoreResponseDto> {
    const identifier = storeId.trim();
    const store = await this.prisma.stores.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      select: CUSTOMER_STORE_DETAIL_SELECT,
    });

    if (!store) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '스토어를 찾을 수 없습니다',
      });
    }

    return toCustomerStoreResponse(store);
  }

  private normalizeLimit(limit: number | undefined): number {
    if (!limit) {
      return DEFAULT_LIMIT;
    }

    return Math.min(limit, MAX_LIMIT);
  }

  private createListWhere(
    keyword: string | undefined,
  ): Prisma.storesWhereInput {
    if (!keyword) {
      return {};
    }

    return {
      OR: [
        { business_name: { contains: keyword } },
        { address: { contains: keyword } },
      ],
    };
  }
}
