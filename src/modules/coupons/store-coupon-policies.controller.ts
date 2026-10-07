import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import {
  CouponPolicyResponseDto,
  CreateCouponPolicyDto,
  ListCouponPoliciesQueryDto,
  UpdateCouponPolicyDto,
} from './dto/coupon.dto';
import { CouponPolicyService } from './services/coupon-policy.service';
import { StaffAllowed } from '../auth/decorators/staff-allowed.decorator';

@ApiTags('Store Coupon Policies')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/store/coupons/policies')
export class StoreCouponPoliciesController {
  constructor(private readonly couponPolicyService: CouponPolicyService) {}

  @Post()
  @ApiOperation({ summary: '매장의 쿠폰 발급 정책을 생성합니다.' })
  @ApiCreatedResponse({ type: CouponPolicyResponseDto })
  createPolicy(
    @CurrentStoreId() storeId: string,
    @Body() dto: CreateCouponPolicyDto,
  ) {
    return this.couponPolicyService.createPolicy(storeId, dto);
  }

  @Get()
  @ApiOperation({ summary: '매장의 쿠폰 발급 정책 목록을 조회합니다.' })
  @ApiOkResponse({ type: [CouponPolicyResponseDto] })
  @StaffAllowed()
  listPolicies(
    @CurrentStoreId() storeId: string,
    @Query() query: ListCouponPoliciesQueryDto,
  ) {
    return this.couponPolicyService.listPolicies(storeId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '매장의 쿠폰 발급 정책 상세를 조회합니다.' })
  @ApiOkResponse({ type: CouponPolicyResponseDto })
  @StaffAllowed()
  getPolicy(@CurrentStoreId() storeId: string, @Param('id') policyId: string) {
    return this.couponPolicyService.getPolicy(storeId, policyId);
  }

  @Put(':id')
  @ApiOperation({ summary: '매장의 쿠폰 발급 정책을 수정합니다.' })
  @ApiOkResponse({ type: CouponPolicyResponseDto })
  updatePolicy(
    @CurrentStoreId() storeId: string,
    @Param('id') policyId: string,
    @Body() dto: UpdateCouponPolicyDto,
  ) {
    return this.couponPolicyService.updatePolicy(storeId, policyId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장의 쿠폰 발급 정책을 삭제합니다.' })
  @ApiOkResponse()
  deletePolicy(
    @CurrentStoreId() storeId: string,
    @Param('id') policyId: string,
  ) {
    return this.couponPolicyService.deletePolicy(storeId, policyId);
  }
}
