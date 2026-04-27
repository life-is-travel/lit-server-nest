import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerStoresService } from './customer-stores.service';
import {
  CustomerStoreListResponseDto,
  CustomerStoreResponseDto,
  ListCustomerStoresQueryDto,
} from './dto/customer-store.dto';

@ApiTags('Customer Stores')
@Controller('api/customer/stores')
export class CustomerStoresController {
  constructor(private readonly customerStoresService: CustomerStoresService) {}

  @Get()
  @ApiOperation({ summary: '고객 앱용 매장 목록을 조회합니다.' })
  @ApiOkResponse({ type: CustomerStoreListResponseDto })
  listStores(@Query() query: ListCustomerStoresQueryDto) {
    return this.customerStoresService.listStores(query);
  }

  @Get(':storeId')
  @ApiOperation({ summary: '고객 앱용 매장 상세를 조회합니다.' })
  @ApiOkResponse({ type: CustomerStoreResponseDto })
  getStoreDetail(@Param('storeId') storeId: string) {
    return this.customerStoresService.getStoreDetail(storeId);
  }
}
