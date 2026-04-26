import { BadRequestException } from '@nestjs/common';
import { reservations_status } from '@prisma/client';
import { ReservationStatusService } from './reservation-status.service';

describe('ReservationStatusService', () => {
  let service: ReservationStatusService;

  beforeEach(() => {
    service = new ReservationStatusService();
  });

  it('normalizes Express-compatible status aliases', () => {
    expect(service.normalizeStatus('approved')).toBe(
      reservations_status.confirmed,
    );
    expect(service.normalizeStatus('active')).toBe(
      reservations_status.in_progress,
    );
  });

  it('rejects invalid reservation status values', () => {
    expect(() => service.normalizeStatus('returned')).toThrow(
      BadRequestException,
    );
  });

  it('allows valid production status transitions', () => {
    expect(() =>
      service.assertCanTransition(
        reservations_status.pending,
        reservations_status.confirmed,
      ),
    ).not.toThrow();
    expect(() =>
      service.assertCanTransition(
        reservations_status.confirmed,
        reservations_status.in_progress,
      ),
    ).not.toThrow();
    expect(() =>
      service.assertCanTransition(
        reservations_status.in_progress,
        reservations_status.completed,
      ),
    ).not.toThrow();
  });

  it('prevents terminal reservation status changes', () => {
    expect(() =>
      service.assertCanTransition(
        reservations_status.completed,
        reservations_status.cancelled,
      ),
    ).toThrow(BadRequestException);
  });
});
