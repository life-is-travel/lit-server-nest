import { BadRequestException } from '@nestjs/common';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

export type KstDateRange = {
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
  dates: string[];
};

export const getKstDateString = (date = new Date()): string =>
  new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

export const getKstDateRange = (
  query: { from?: string; to?: string },
  defaultDays = 7,
): KstDateRange => {
  const today = getKstDateString();
  const to = query.to ?? today;
  const from = query.from ?? addKstDays(to, -(defaultDays - 1));
  const start = toKstStart(from);
  const endExclusive = toKstStart(addKstDays(to, 1));
  const days = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);

  if (days <= 0) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: 'from은 to보다 늦을 수 없습니다.',
    });
  }

  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException({
      code: 'DATE_RANGE_TOO_LARGE',
      message: `조회 기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.`,
    });
  }

  return {
    from,
    to,
    start,
    endExclusive,
    dates: buildDateBuckets(from, days),
  };
};

export const addKstDays = (dateString: string, days: number): string => {
  const start = toKstStart(dateString);

  return getKstDateString(new Date(start.getTime() + days * DAY_MS));
};

const toKstStart = (dateString: string): Date => {
  const date = new Date(`${dateString}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime()) || getKstDateString(date) !== dateString) {
    throw new BadRequestException({
      code: 'INVALID_DATE',
      message: '날짜는 YYYY-MM-DD 형식의 올바른 KST 일자여야 합니다.',
      details: { date: dateString },
    });
  }

  return date;
};

const buildDateBuckets = (from: string, days: number): string[] =>
  Array.from({ length: days }, (_, index) => addKstDays(from, index));
