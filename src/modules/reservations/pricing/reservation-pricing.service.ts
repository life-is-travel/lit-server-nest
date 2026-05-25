import { Injectable } from '@nestjs/common';
import { reservations_requested_storage_type } from '@prisma/client';
import {
  getFrozenPricePerBagPerDay,
  STORAGE_BILLING_TIMEZONE,
} from './reservation-pricing.constants';

export type ReservationPricingInput = {
  storageType: reservations_requested_storage_type;
  bagCount: number;
  startTime: Date;
  endTime: Date;
};

@Injectable()
export class ReservationPricingService {
  calculateTotalAmount(input: ReservationPricingInput): number {
    const pricePerBagPerDay = getFrozenPricePerBagPerDay(input.storageType);
    const storageDays = this.countStorageDays(input.startTime, input.endTime);

    return pricePerBagPerDay * input.bagCount * storageDays;
  }

  countStorageDays(startTime: Date, endTime: Date): number {
    const startDate = this.toKstDateKey(startTime);
    const endDate = this.toKstDateKey(endTime);
    const startMs = this.toKstMidnightMs(startDate);
    const endMs = this.toKstMidnightMs(endDate);

    return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  }

  private toKstDateKey(date: Date): string {
    return date.toLocaleDateString('en-CA', {
      timeZone: STORAGE_BILLING_TIMEZONE,
    });
  }

  private toKstMidnightMs(dateKey: string): number {
    return new Date(`${dateKey}T00:00:00+09:00`).getTime();
  }
}
