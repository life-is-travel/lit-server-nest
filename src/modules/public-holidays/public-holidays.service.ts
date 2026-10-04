import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import {
  ListPublicHolidaysQueryDto,
  PublicHolidayResponseDto,
} from './dto/public-holiday.dto';

const DEFAULT_RANGE_DAYS = 400;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PublicHolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListPublicHolidaysQueryDto,
    now: Date = new Date(),
  ): Promise<PublicHolidayResponseDto[]> {
    const from = this.parseDate(query.from) ?? this.todayInKst(now);
    const to =
      this.parseDate(query.to) ??
      new Date(from.getTime() + DEFAULT_RANGE_DAYS * DAY_MS);

    if (to.getTime() < from.getTime()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'to는 from보다 빠를 수 없습니다.',
      });
    }

    const rows = await this.prisma.public_holidays.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      name: row.name,
    }));
  }

  /** YYYY-MM-DD → UTC 자정 Date. 없으면 null */
  private parseDate(value: string | undefined): Date | null {
    return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
  }

  /** 지금 시각의 한국 날짜를 UTC 자정으로 표현한다(@db.Date 비교용) */
  private todayInKst(now: Date): Date {
    const kst = new Date(now.getTime() + KST_OFFSET_MS);
    return new Date(`${kst.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }
}
