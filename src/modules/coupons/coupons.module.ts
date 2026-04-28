import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { CustomerCouponsController } from './customer-coupons.controller';
import { GuestCouponsController } from './guest-coupons.controller';
import { StoreCouponPoliciesController } from './store-coupon-policies.controller';
import { CouponAutoIssueService } from './services/coupon-auto-issue.service';
import { CouponPolicyService } from './services/coupon-policy.service';
import { CustomerCouponService } from './services/customer-coupon.service';
import { GuestCouponService } from './services/guest-coupon.service';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [
    CustomerCouponsController,
    GuestCouponsController,
    StoreCouponPoliciesController,
  ],
  providers: [
    CustomerCouponService,
    GuestCouponService,
    CouponPolicyService,
    CouponAutoIssueService,
  ],
  exports: [CouponAutoIssueService],
})
export class CouponsModule {}
