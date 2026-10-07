import { ForbiddenException } from '@nestjs/common';
import { reservations_status } from '@prisma/client';
import type { AuthenticatedStore } from '../guards/store-auth.guard';

/** 직원(F-024)이 받는 응답·할 수 있는 동작을 점주와 구분하는 규칙. */

const isStaff = (actor: AuthenticatedStore | undefined): boolean =>
  actor?.role === 'staff';

/** 직원에게는 매출 금액을 null로 내려준다. */
export const hideRevenueForStaff = <T extends object, K extends keyof T>(
  actor: AuthenticatedStore | undefined,
  value: T,
  revenueKeys: K[],
): T | (Omit<T, K> & Record<K, null>) => {
  if (!isStaff(actor)) return value;

  const masked = { ...value } as Record<string, unknown>;
  for (const key of revenueKeys) masked[key as string] = null;
  return masked as Omit<T, K> & Record<K, null>;
};

type OwnerPrivateFields = {
  email?: string | null;
  phoneNumber?: string | null;
  notificationPhone?: string | null;
  notificationPhones?: string[] | null;
  businessNumber?: string | null;
  representativeName?: string | null;
};

/** 직원에게는 점주 개인 연락처·사업자 신원 정보를 내려주지 않는다. */
export const hideOwnerPrivateFields = <T extends OwnerPrivateFields>(
  actor: AuthenticatedStore | undefined,
  profile: T,
): T => {
  if (!isStaff(actor)) return profile;

  return {
    ...profile,
    email: null,
    phoneNumber: null,
    notificationPhone: null,
    notificationPhones: [],
    businessNumber: null,
    representativeName: null,
  };
};

// 환불이 걸린 거절·취소는 점주 전용이다. 상태 변경 API로 우회하지 못하게 막는다.
const OWNER_ONLY_STATUSES: reservations_status[] = [
  reservations_status.rejected,
  reservations_status.cancelled,
];

export const assertActorCanSetReservationStatus = (
  actor: AuthenticatedStore | undefined,
  status: reservations_status,
): void => {
  if (isStaff(actor) && OWNER_ONLY_STATUSES.includes(status)) {
    throw new ForbiddenException({
      code: 'OWNER_ONLY',
      message: '예약 거절·취소는 점주만 할 수 있습니다.',
    });
  }
};
