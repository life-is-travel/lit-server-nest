import { Reflector } from '@nestjs/core';
import { StoreCouponPoliciesController } from '../coupons/store-coupon-policies.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { ReservationsController } from '../reservations/reservations.controller';
import { StoreReviewsController } from '../reviews/store-reviews.controller';
import { StaffAuthController } from '../staff/staff-auth.controller';
import { StoreStaffController } from '../staff/store-staff.controller';
import { StoragesController } from '../storages/storages.controller';
import { StoresController } from '../stores/stores.controller';
import { UploadsController } from '../uploads/uploads.controller';
import { STAFF_ALLOWED_KEY } from './decorators/staff-allowed.decorator';
import { AuthController } from './auth.controller';

/**
 * 직원 권한표(PRD F-024)를 코드로 고정한다.
 * 점주 API를 추가·변경해서 이 표와 달라지면 실패한다 → PRD와 함께 의도적으로 갱신할 것.
 */
const STAFF_ALLOWED: Record<string, string[]> = {
  ReservationsController: [
    'createReservation',
    'getReservations',
    'getReservation',
    'approveReservation',
    'updateReservationStatus',
    'storeCheckin',
    'markNoShow',
    'setLuggageOwnerMemo',
  ],
  StoresController: [
    'getProfile',
    'getStatus',
    'updateStatus',
    'openStore',
    'closeStore',
    'getSettings',
  ],
  StoragesController: ['listStorages', 'getStorage'],
  DashboardController: ['getSummary', 'getRealtime'],
  StoreReviewsController: ['listReviews', 'getStatistics'],
  StoreCouponPoliciesController: ['listPolicies', 'getPolicy'],
  UploadsController: ['presignForStore'],
  StaffAuthController: ['leave'],
  StoreStaffController: [],
  AuthController: [],
};

const CONTROLLERS = [
  ReservationsController,
  StoresController,
  StoragesController,
  DashboardController,
  StoreReviewsController,
  StoreCouponPoliciesController,
  UploadsController,
  StaffAuthController,
  StoreStaffController,
  AuthController,
];

const staffAllowedHandlers = (controller: { prototype: object }): string[] => {
  const reflector = new Reflector();
  const proto = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .filter((name) =>
      reflector.get<boolean>(STAFF_ALLOWED_KEY, proto[name] as () => unknown),
    )
    .sort();
};

describe('직원 권한표 (F-024)', () => {
  it.each(CONTROLLERS.map((controller) => [controller.name, controller]))(
    '%s의 직원 허용 API가 PRD 권한표와 같다',
    (name, controller) => {
      expect(staffAllowedHandlers(controller)).toEqual(
        [...(STAFF_ALLOWED[name] ?? [])].sort(),
      );
    },
  );

  it('예약 거절·취소는 직원에게 열려 있지 않다', () => {
    const allowed = staffAllowedHandlers(ReservationsController);

    expect(allowed).not.toContain('rejectReservation');
    expect(allowed).not.toContain('cancelReservation');
  });
});
