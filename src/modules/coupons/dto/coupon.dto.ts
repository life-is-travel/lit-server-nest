import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  coupon_policies_type,
  coupons_status,
  coupons_type,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  optionalBoolean,
  optionalNumber,
} from '../../../common/transformers/legacy-input.transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ClaimCouponDto {
  @ApiProperty({
    description: 'manual_claim으로 공개된 coupon policy ID',
    example: 'coup_pol_...',
  })
  @IsString()
  @MaxLength(255)
  policyId!: string;
}

export class ListCouponsQueryDto {
  @ApiPropertyOptional({ enum: coupons_status })
  @IsOptional()
  @IsEnum(coupons_status)
  status?: coupons_status;

  @ApiPropertyOptional({ enum: coupons_type })
  @IsOptional()
  @IsEnum(coupons_type)
  type?: coupons_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RedeemStoreBenefitCouponDto {
  @ApiProperty({ description: '매장 직원이 입력하는 4자리 PIN' })
  @Matches(/^\d{4}$/, { message: 'storePin은 4자리 숫자여야 합니다.' })
  storePin!: string;
}

export class GuestCouponAccessQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phoneNumber!: string;

  @ApiProperty({ description: '비회원 예약 조회 토큰' })
  @IsString()
  @MaxLength(255)
  token!: string;
}

export class RedeemGuestStoreBenefitCouponDto {
  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phoneNumber!: string;

  @ApiProperty({ description: '비회원 예약 조회 토큰' })
  @IsString()
  @MaxLength(255)
  token!: string;

  @ApiProperty({ description: '매장 직원이 입력하는 4자리 PIN' })
  @Matches(/^\d{4}$/, { message: 'storePin은 4자리 숫자여야 합니다.' })
  storePin!: string;
}

export class CouponResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  storeId!: string | null;

  @ApiProperty({ enum: coupons_type })
  type!: coupons_type;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  discountAmount!: number | null;

  @ApiPropertyOptional()
  discountRate!: number | null;

  @ApiPropertyOptional()
  minSpend!: number | null;

  @ApiPropertyOptional()
  maxDiscount!: number | null;

  @ApiPropertyOptional()
  benefitItem!: string | null;

  @ApiPropertyOptional()
  benefitValue!: string | null;

  @ApiProperty({ enum: coupons_status })
  status!: coupons_status;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiPropertyOptional()
  usedAt!: Date | null;

  @ApiPropertyOptional()
  reservationId!: string | null;

  @ApiPropertyOptional()
  paymentId!: bigint | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CouponListResponseDto {
  @ApiProperty({ type: [CouponResponseDto] })
  items!: CouponResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}

export class CouponStatsResponseDto {
  @ApiProperty()
  activeCount!: number;

  @ApiProperty()
  usedCount!: number;

  @ApiProperty()
  expiredCount!: number;
}

export class CouponPolicyBaseDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: coupon_policies_type })
  @IsEnum(coupon_policies_type)
  type!: coupon_policies_type;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  discountAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  discountRate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minSpend?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxDiscount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  benefitItem?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  benefitValue?: string | null;

  @ApiPropertyOptional({
    enum: ['manual_claim', 'signup', 'checkin_completed'],
    default: 'manual_claim',
  })
  @IsOptional()
  @IsIn(['manual_claim', 'signup', 'checkin_completed'])
  autoIssueOn?: 'manual_claim' | 'signup' | 'checkin_completed';

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 365 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;
}

export class CreateCouponPolicyDto extends CouponPolicyBaseDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateCouponPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: coupon_policies_type })
  @IsOptional()
  @IsEnum(coupon_policies_type)
  type?: coupon_policies_type;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  discountAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  discountRate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minSpend?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxDiscount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  benefitItem?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  benefitValue?: string | null;

  @ApiPropertyOptional({
    enum: ['manual_claim', 'signup', 'checkin_completed'],
  })
  @IsOptional()
  @IsIn(['manual_claim', 'signup', 'checkin_completed'])
  autoIssueOn?: 'manual_claim' | 'signup' | 'checkin_completed';

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  enabled?: boolean;
}

export class ListCouponPoliciesQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false', '1', '0'] })
  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  enabled?: string;

  @ApiPropertyOptional({ enum: coupon_policies_type })
  @IsOptional()
  @IsEnum(coupon_policies_type)
  type?: coupon_policies_type;

  @ApiPropertyOptional({
    enum: ['manual_claim', 'signup', 'checkin_completed'],
  })
  @IsOptional()
  @IsIn(['manual_claim', 'signup', 'checkin_completed'])
  autoIssueOn?: 'manual_claim' | 'signup' | 'checkin_completed';
}

export class CouponPolicyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  storeId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: coupon_policies_type })
  type!: coupon_policies_type;

  @ApiPropertyOptional()
  discountAmount!: number | null;

  @ApiPropertyOptional()
  discountRate!: number | null;

  @ApiPropertyOptional()
  minSpend!: number | null;

  @ApiPropertyOptional()
  maxDiscount!: number | null;

  @ApiPropertyOptional()
  benefitItem!: string | null;

  @ApiPropertyOptional()
  benefitValue!: string | null;

  @ApiProperty()
  autoIssueOn!: string;

  @ApiProperty()
  validityDays!: number;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
