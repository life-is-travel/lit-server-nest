import { Injectable, Logger } from '@nestjs/common';
import {
  coupon_policies,
  coupon_policies_auto_issue_on,
  coupons_status,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/database/prisma.service';

export type IssueCouponsForTriggerParams = {
  customerId?: string | null;
  phoneSnapshot?: string | null;
  storeId?: string | null;
  trigger: coupon_policies_auto_issue_on | 'reservation_completed';
  reservationId?: string | null;
};

@Injectable()
export class CouponAutoIssueService {
  private readonly logger = new Logger(CouponAutoIssueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issueForTrigger(
    params: IssueCouponsForTriggerParams,
  ): Promise<string[]> {
    const phoneSnapshot = this.normalizePhone(params.phoneSnapshot);
    const customerId =
      params.customerId ?? this.createGuestCouponOwner(phoneSnapshot);

    if (!customerId) {
      return [];
    }

    if (params.trigger === 'reservation_completed') {
      return [];
    }

    const policies = await this.prisma.coupon_policies.findMany({
      where: {
        auto_issue_on: params.trigger,
        enabled: 1,
        ...(params.storeId
          ? { OR: [{ store_id: null }, { store_id: params.storeId }] }
          : { store_id: null }),
      },
    });

    const createdIds: string[] = [];

    for (const policy of policies) {
      const createdId = await this.issuePolicyCoupon(policy, {
        ...params,
        customerId,
        phoneSnapshot,
      }).catch((error: unknown) => {
        this.logger.warn(
          `coupon auto issue skipped: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        return null;
      });

      if (createdId) {
        createdIds.push(createdId);
      }
    }

    return createdIds;
  }

  async issueGuestCouponsForTrigger(
    params: Omit<IssueCouponsForTriggerParams, 'customerId'> & {
      phoneSnapshot: string;
    },
  ): Promise<string[]> {
    return this.issueForTrigger({
      ...params,
      customerId: null,
      phoneSnapshot: params.phoneSnapshot,
    });
  }

  private async issuePolicyCoupon(
    policy: coupon_policies,
    params: IssueCouponsForTriggerParams & {
      customerId: string;
      phoneSnapshot?: string | null;
    },
  ): Promise<string | null> {
    const storeId = policy.store_id ?? params.storeId ?? null;
    const isGuestCoupon =
      !!params.phoneSnapshot && params.customerId.startsWith('guest_phone_');
    const duplicate = await this.prisma.coupons.findFirst({
      where: {
        customer_id: params.customerId,
        store_id: storeId,
        type: policy.type,
        title: policy.name,
        ...(params.reservationId
          ? { reservation_id: params.reservationId }
          : {}),
        ...(isGuestCoupon ? { phone_snapshot: params.phoneSnapshot } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      return null;
    }

    const couponId = `coup_${randomUUID()}`;
    await this.prisma.coupons.create({
      data: {
        id: couponId,
        customer_id: params.customerId,
        store_id: storeId,
        type: policy.type,
        title: policy.name || '쿠폰',
        description: null,
        discount_amount: policy.discount_amount,
        discount_rate: policy.discount_rate,
        min_spend: policy.min_spend,
        max_discount: policy.max_discount,
        benefit_item: policy.benefit_item,
        benefit_value: policy.benefit_value,
        status: coupons_status.active,
        issued_at: new Date(),
        expires_at: this.addDays(policy.validity_days || 7),
        used_at: null,
        reservation_id: params.reservationId ?? null,
        phone_snapshot: params.phoneSnapshot ?? null,
        payment_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return couponId;
  }

  private normalizePhone(phone?: string | null): string | null {
    const normalized = String(phone ?? '').replace(/[-\s]/g, '');

    return normalized.length > 0 ? normalized : null;
  }

  private createGuestCouponOwner(phoneSnapshot: string | null): string | null {
    return phoneSnapshot ? `guest_phone_${phoneSnapshot}` : null;
  }

  private addDays(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
