import { ownerReservationDisplayLabel } from './owner-reservation-display.util';

describe('ownerReservationDisplayLabel', () => {
  it('shows phone for Korean guest bookings', () => {
    expect(
      ownerReservationDisplayLabel({
        customerName: '고객',
        phone: '01012345678',
      }),
    ).toBe('01012345678');
  });

  it('shows phone instead of masked generic name', () => {
    expect(
      ownerReservationDisplayLabel({
        customerName: '고*',
        phone: '01098765432',
      }),
    ).toBe('01098765432');
  });

  it('shows email for foreign email bookings', () => {
    expect(
      ownerReservationDisplayLabel({
        customerName: 'Guest',
        phone: 'traveler@example.com',
        email: 'traveler@example.com',
      }),
    ).toBe('traveler@example.com');
  });

  it('falls back to name when contact is missing', () => {
    expect(
      ownerReservationDisplayLabel({
        customerName: '홍길동',
      }),
    ).toBe('홍길동');
  });
});
