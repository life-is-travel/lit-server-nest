import { ForbiddenException } from '@nestjs/common';
import { reservations_status } from '@prisma/client';
import {
  assertActorCanSetReservationStatus,
  hideOwnerPrivateFields,
  hideRevenueForStaff,
} from './staff-view.util';

const OWNER = {
  storeId: 'store_1',
  email: 'o@example.com',
  role: 'owner' as const,
  type: 'access' as const,
};
const STAFF = {
  storeId: 'store_1',
  staffId: 'staff_1',
  role: 'staff' as const,
  type: 'access' as const,
};

describe('staff-view.util', () => {
  it('hides revenue fields only for staff', () => {
    const summary = {
      totalRevenue: 50000,
      todayRevenue: 9000,
      todayReservations: 3,
    };

    expect(
      hideRevenueForStaff(STAFF, summary, ['totalRevenue', 'todayRevenue']),
    ).toEqual({
      totalRevenue: null,
      todayRevenue: null,
      todayReservations: 3,
    });
    expect(
      hideRevenueForStaff(OWNER, summary, ['totalRevenue', 'todayRevenue']),
    ).toBe(summary);
  });

  it('hides owner private contact and business identity fields only for staff', () => {
    const profile = {
      id: 'store_1',
      email: 'o@example.com',
      businessName: '루라운지',
      phoneNumber: '01012345678',
      storePhoneNumber: '050700000000',
      notificationPhone: '01099998888',
      notificationPhones: ['01011112222'],
      businessNumber: '1234567890',
      representativeName: '홍길동',
      address: '서울',
    };

    expect(hideOwnerPrivateFields(STAFF, profile)).toEqual({
      ...profile,
      email: null,
      phoneNumber: null,
      notificationPhone: null,
      notificationPhones: [],
      businessNumber: null,
      representativeName: null,
    });
    expect(hideOwnerPrivateFields(OWNER, profile)).toBe(profile);
  });

  it('forbids staff from rejecting or cancelling through the status API', () => {
    for (const status of [
      reservations_status.rejected,
      reservations_status.cancelled,
    ]) {
      expect(() => assertActorCanSetReservationStatus(STAFF, status)).toThrow(
        ForbiddenException,
      );
      expect(() =>
        assertActorCanSetReservationStatus(OWNER, status),
      ).not.toThrow();
    }
    expect(() =>
      assertActorCanSetReservationStatus(STAFF, reservations_status.completed),
    ).not.toThrow();
  });
});
