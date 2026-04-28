import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { coupons, coupons_status, coupons_type } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { StorePinService } from '../../stores/services/store-pin.service';
import {
  CouponListResponseDto,
  CouponResponseDto,
  GuestCouponAccessQueryDto,
  RedeemGuestStoreBenefitCouponDto,
} from '../dto/coupon.dto';
import { toCouponResponse } from '../mappers/coupon.mapper';

@Injectable()
export class GuestCouponService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storePinService: StorePinService,
  ) {}

  async listCoupons(
    query: GuestCouponAccessQueryDto,
  ): Promise<CouponListResponseDto> {
    const phoneNumber = this.normalizePhone(query.phoneNumber);

    await this.assertGuestAccess(phoneNumber, query.token);
    await this.expireGuestCoupons(phoneNumber);

    const coupons = await this.prisma.coupons.findMany({
      where: { phone_snapshot: phoneNumber },
      orderBy: { created_at: 'desc' },
    });

    return {
      items: coupons.map(toCouponResponse),
      page: 1,
      limit: coupons.length,
      total: coupons.length,
    };
  }

  async getCoupon(
    couponId: string,
    query: GuestCouponAccessQueryDto,
  ): Promise<CouponResponseDto> {
    const phoneNumber = this.normalizePhone(query.phoneNumber);
    const coupon = await this.findGuestCoupon(couponId, phoneNumber);

    await this.assertGuestAccess(
      phoneNumber,
      query.token,
      coupon.reservation_id,
    );

    const normalized = await this.expireCouponIfNeeded(coupon);

    return toCouponResponse(normalized);
  }

  async redeemCoupon(
    couponId: string,
    dto: RedeemGuestStoreBenefitCouponDto,
  ): Promise<CouponResponseDto> {
    const phoneNumber = this.normalizePhone(dto.phoneNumber);
    const coupon = await this.findGuestCoupon(couponId, phoneNumber);

    await this.assertGuestAccess(phoneNumber, dto.token, coupon.reservation_id);
    this.assertRedeemableStoreBenefitCoupon(coupon);

    if (coupon.expires_at <= new Date()) {
      const expired = await this.markExpired(coupon.id);
      throw new BadRequestException({
        code: 'EXPIRED',
        message: '만료된 쿠폰입니다.',
        details: { coupon: toCouponResponse(expired) },
      });
    }

    await this.storePinService.verifyPinForStore(
      coupon.store_id!,
      dto.storePin,
    );

    const now = new Date();
    const result = await this.prisma.coupons.updateMany({
      where: {
        id: coupon.id,
        phone_snapshot: phoneNumber,
        status: coupons_status.active,
      },
      data: {
        status: coupons_status.used,
        used_at: now,
        updated_at: now,
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: '이미 사용되었거나 만료된 쿠폰입니다.',
      });
    }

    const updated = await this.prisma.coupons.findUniqueOrThrow({
      where: { id: coupon.id },
    });

    return toCouponResponse(updated);
  }

  private async findGuestCoupon(
    couponId: string,
    phoneNumber: string,
  ): Promise<coupons> {
    const coupon = await this.prisma.coupons.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '쿠폰을 찾을 수 없습니다.',
      });
    }

    if (coupon.phone_snapshot !== phoneNumber) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '해당 전화번호의 쿠폰이 아닙니다.',
      });
    }

    return coupon;
  }

  private async assertGuestAccess(
    phoneNumber: string,
    token: string,
    reservationId?: string | null,
  ): Promise<void> {
    const reservation = await this.prisma.reservations.findFirst({
      where: {
        customer_phone: phoneNumber,
        qr_code: token,
        ...(reservationId ? { id: reservationId } : {}),
      },
      select: { id: true },
    });

    if (!reservation) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '비회원 쿠폰 접근 권한을 확인할 수 없습니다.',
      });
    }
  }

  private assertRedeemableStoreBenefitCoupon(coupon: coupons): void {
    if (coupon.type === coupons_type.payment_discount) {
      throw new BadRequestException({
        code: 'PAYMENT_COUPON_USE_NOT_SUPPORTED',
        message: '결제 할인 쿠폰은 결제 모듈에서만 사용할 수 있습니다.',
      });
    }

    if (coupon.type !== coupons_type.store_benefit) {
      throw new BadRequestException({
        code: 'INVALID_COUPON_TYPE',
        message: '매장 혜택 쿠폰만 사용할 수 있습니다.',
      });
    }

    if (!coupon.store_id) {
      throw new BadRequestException({
        code: 'STORE_REQUIRED',
        message: '매장 혜택 쿠폰에는 storeId가 필요합니다.',
      });
    }

    if (coupon.status !== coupons_status.active) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: '이미 사용되었거나 만료된 쿠폰입니다.',
      });
    }
  }

  private async expireGuestCoupons(phoneNumber: string): Promise<void> {
    await this.prisma.coupons.updateMany({
      where: {
        phone_snapshot: phoneNumber,
        status: coupons_status.active,
        expires_at: { lt: new Date() },
      },
      data: {
        status: coupons_status.expired,
        updated_at: new Date(),
      },
    });
  }

  private async expireCouponIfNeeded(coupon: coupons): Promise<coupons> {
    if (
      coupon.status === coupons_status.active &&
      coupon.expires_at <= new Date()
    ) {
      return this.markExpired(coupon.id);
    }

    return coupon;
  }

  private async markExpired(couponId: string): Promise<coupons> {
    return this.prisma.coupons.update({
      where: { id: couponId },
      data: {
        status: coupons_status.expired,
        updated_at: new Date(),
      },
    });
  }

  private normalizePhone(phone: string): string {
    const normalized = String(phone).replace(/[-\s]/g, '');

    if (normalized.length < 10 || normalized.length > 15) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '올바른 전화번호를 입력해주세요.',
      });
    }

    return normalized;
  }
}
