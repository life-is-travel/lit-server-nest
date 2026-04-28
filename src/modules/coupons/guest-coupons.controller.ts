import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard';
import {
  CouponListResponseDto,
  CouponResponseDto,
  GuestCouponAccessQueryDto,
  RedeemGuestStoreBenefitCouponDto,
} from './dto/coupon.dto';
import { GuestCouponService } from './services/guest-coupon.service';

@ApiTags('Guest Coupons')
@UseGuards(AuthThrottlerGuard)
@Controller('api/guest/coupons')
export class GuestCouponsController {
  constructor(private readonly guestCouponService: GuestCouponService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '비회원 전화번호 기반 쿠폰 목록을 조회합니다.' })
  @ApiOkResponse({ type: CouponListResponseDto })
  listCoupons(@Query() query: GuestCouponAccessQueryDto) {
    return this.guestCouponService.listCoupons(query);
  }

  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '비회원 전화번호 기반 쿠폰 상세를 조회합니다.' })
  @ApiOkResponse({ type: CouponResponseDto })
  getCoupon(
    @Param('id') couponId: string,
    @Query() query: GuestCouponAccessQueryDto,
  ) {
    return this.guestCouponService.getCoupon(couponId, query);
  }

  @Post(':id/redeem')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '비회원 매장 혜택 쿠폰을 매장 PIN으로 사용 처리합니다.',
  })
  @ApiOkResponse({ type: CouponResponseDto })
  redeemCoupon(
    @Param('id') couponId: string,
    @Body() dto: RedeemGuestStoreBenefitCouponDto,
  ) {
    return this.guestCouponService.redeemCoupon(couponId, dto);
  }
}
