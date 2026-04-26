import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { getKstDateRange } from '../../dashboard/utils/kst-date-range.util';
import {
  ListStoreReservationsQueryDto,
  ReservationListResponseDto,
  ReservationResponseDto,
} from '../dto/reservation.dto';
import { toReservationResponse } from '../mappers/reservation.mapper';

@Injectable()
export class ReservationQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listStoreReservations(
    storeId: string,
    query: ListStoreReservationsQueryDto,
  ): Promise<ReservationListResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where = this.buildStoreReservationWhere(storeId, query);
    const [total, reservations] = await Promise.all([
      this.prisma.reservations.count({ where }),
      this.prisma.reservations.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: reservations.map(toReservationResponse),
      page,
      limit,
      total,
    };
  }

  async getStoreReservation(
    storeId: string,
    reservationId: string,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.findStoreReservationOrThrow(
      storeId,
      reservationId,
    );

    return toReservationResponse(reservation);
  }

  async findStoreReservationOrThrow(storeId: string, reservationId: string) {
    const reservation = await this.prisma.reservations.findFirst({
      where: {
        id: reservationId,
        store_id: storeId,
      },
    });

    if (!reservation) {
      throw this.reservationNotFound();
    }

    return reservation;
  }

  reservationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: '예약을 찾을 수 없습니다.',
    });
  }

  private buildStoreReservationWhere(
    storeId: string,
    query: ListStoreReservationsQueryDto,
  ): Prisma.reservationsWhereInput {
    const dateRange = query.date
      ? getKstDateRange({ from: query.date, to: query.date }, 1)
      : null;

    return {
      store_id: storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customer_id: query.customerId } : {}),
      ...(dateRange
        ? {
            start_time: {
              gte: dateRange.start,
              lt: dateRange.endExclusive,
            },
          }
        : {}),
    };
  }
}
