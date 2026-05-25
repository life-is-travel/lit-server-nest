import { reservations_requested_storage_type } from '@prisma/client';
import { ReservationPricingService } from './reservation-pricing.service';

describe('ReservationPricingService', () => {
  const service = new ReservationPricingService();

  it('charges fixed 소형 price for same-day storage', () => {
    const total = service.calculateTotalAmount({
      storageType: reservations_requested_storage_type.s,
      bagCount: 2,
      startTime: new Date('2026-04-27T01:00:00.000Z'),
      endTime: new Date('2026-04-27T05:00:00.000Z'),
    });

    expect(total).toBe(9000);
  });

  it('applies progressive pricing when storage crosses midnight in KST', () => {
    const total = service.calculateTotalAmount({
      storageType: reservations_requested_storage_type.s,
      bagCount: 1,
      startTime: new Date('2026-04-27T13:00:00.000Z'),
      endTime: new Date('2026-04-28T04:00:00.000Z'),
    });

    expect(total).toBe(9000);
  });

  it('uses 중형 and 대형 fixed prices', () => {
    expect(
      service.calculateTotalAmount({
        storageType: reservations_requested_storage_type.m,
        bagCount: 1,
        startTime: new Date('2026-04-27T01:00:00.000Z'),
        endTime: new Date('2026-04-27T05:00:00.000Z'),
      }),
    ).toBe(6000);

    expect(
      service.calculateTotalAmount({
        storageType: reservations_requested_storage_type.l,
        bagCount: 1,
        startTime: new Date('2026-04-27T01:00:00.000Z'),
        endTime: new Date('2026-04-27T05:00:00.000Z'),
      }),
    ).toBe(8000);
  });

  it('maps legacy xl storage type to 대형 pricing', () => {
    const total = service.calculateTotalAmount({
      storageType: reservations_requested_storage_type.xl,
      bagCount: 1,
      startTime: new Date('2026-04-27T01:00:00.000Z'),
      endTime: new Date('2026-04-27T05:00:00.000Z'),
    });

    expect(total).toBe(8000);
  });
});
