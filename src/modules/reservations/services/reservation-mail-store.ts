import { coupon_policies_type } from '@prisma/client';
import type { PrismaService } from '../../../common/database/prisma.service';
import type { ReservationMailStore } from '../../auth/services/reservation-created-mail';

export type ReservationMailStoreInfo = {
  store: ReservationMailStore | null;
  hasStoreCoupon: boolean;
  couponValidityDays: number | null;
};

/**
 * 예약 생성 메일(F-020)에 넣을 매장 정보와 쿠폰 여부.
 * 쿠폰 조건은 공개 쿠폰 정책 조회(listPublicPolicies)와 같다: 사용 중 + 매장 혜택형.
 * 조회가 실패해도 메일은 상호만으로 나가야 하므로 예외를 던지지 않는다.
 */
export async function loadReservationMailStoreInfo(
  prisma: PrismaService,
  storeId: string,
): Promise<ReservationMailStoreInfo> {
  try {
    const [store, policy] = await Promise.all([
      prisma.stores.findUnique({
        where: { id: storeId },
        select: {
          business_name: true,
          address: true,
          detail_address: true,
          latitude: true,
          longitude: true,
          slug: true,
        },
      }),
      prisma.coupon_policies.findFirst({
        where: {
          store_id: storeId,
          enabled: 1,
          type: coupon_policies_type.store_benefit,
        },
        orderBy: { created_at: 'desc' },
        select: { validity_days: true },
      }),
    ]);

    return {
      store: store
        ? {
            name: store.business_name,
            address: store.address,
            detailAddress: store.detail_address,
            latitude: store.latitude === null ? null : Number(store.latitude),
            longitude:
              store.longitude === null ? null : Number(store.longitude),
            slug: store.slug,
          }
        : null,
      hasStoreCoupon: policy !== null,
      couponValidityDays: policy?.validity_days ?? null,
    };
  } catch {
    return { store: null, hasStoreCoupon: false, couponValidityDays: null };
  }
}
