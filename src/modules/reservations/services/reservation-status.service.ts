import { BadRequestException, Injectable } from '@nestjs/common';
import { reservations_status } from '@prisma/client';
import { TERMINAL_RESERVATION_STATUSES } from '../reservation.constants';

@Injectable()
export class ReservationStatusService {
  normalizeStatus(status: string): reservations_status {
    const normalized = status.trim();
    const aliases: Record<string, reservations_status> = {
      approved: reservations_status.confirmed,
      active: reservations_status.in_progress,
    };
    const value = aliases[normalized] ?? normalized;

    if (!this.isReservationStatus(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '허용되지 않는 상태입니다.',
        details: {
          allowed: Object.values(reservations_status),
          received: status,
        },
      });
    }

    return value;
  }

  assertCanApprove(currentStatus: reservations_status | null): void {
    if (
      currentStatus === reservations_status.pending ||
      currentStatus === reservations_status.pending_approval ||
      currentStatus === reservations_status.confirmed
    ) {
      return;
    }

    this.throwInvalidStatus('승인 가능한 상태가 아닙니다.', currentStatus);
  }

  assertCanCheckin(currentStatus: reservations_status | null): void {
    if (
      currentStatus === reservations_status.confirmed ||
      currentStatus === reservations_status.in_progress
    ) {
      return;
    }

    this.throwInvalidStatus('체크인 가능한 상태가 아닙니다.', currentStatus);
  }

  assertCanTransition(
    currentStatus: reservations_status | null,
    nextStatus: reservations_status,
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }

    if (
      currentStatus &&
      TERMINAL_RESERVATION_STATUSES.includes(currentStatus)
    ) {
      this.throwInvalidStatus('이미 종료된 예약 상태는 변경할 수 없습니다.', {
        currentStatus,
        nextStatus,
      });
    }

    const allowedNextStatuses = this.getAllowedNextStatuses(currentStatus);

    if (!allowedNextStatuses.includes(nextStatus)) {
      this.throwInvalidStatus('허용되지 않는 예약 상태 변경입니다.', {
        currentStatus,
        nextStatus,
        allowedNextStatuses,
      });
    }
  }

  private getAllowedNextStatuses(
    currentStatus: reservations_status | null,
  ): reservations_status[] {
    switch (currentStatus) {
      case reservations_status.pending:
      case reservations_status.pending_approval:
        return [
          reservations_status.confirmed,
          reservations_status.rejected,
          reservations_status.cancelled,
        ];
      case reservations_status.confirmed:
        return [
          reservations_status.in_progress,
          reservations_status.completed,
          reservations_status.cancelled,
        ];
      case reservations_status.in_progress:
        return [reservations_status.completed, reservations_status.cancelled];
      default:
        return [];
    }
  }

  private isReservationStatus(value: string): value is reservations_status {
    return Object.values(reservations_status).includes(
      value as reservations_status,
    );
  }

  private throwInvalidStatus(message: string, details: unknown): never {
    throw new BadRequestException({
      code: 'INVALID_STATUS',
      message,
      details,
    });
  }
}
