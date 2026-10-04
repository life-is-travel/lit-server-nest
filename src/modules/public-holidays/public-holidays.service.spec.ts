import { BadRequestException } from '@nestjs/common';
import { PublicHolidaysService } from './public-holidays.service';

const row = (date: string, name: string) => ({
  date: new Date(`${date}T00:00:00.000Z`),
  name,
  created_at: null,
});

const createService = (rows: ReturnType<typeof row>[] = []) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { public_holidays: { findMany } };

  return { service: new PublicHolidaysService(prisma as never), findMany };
};

describe('PublicHolidaysService', () => {
  it('returns holidays as YYYY-MM-DD strings in date order', async () => {
    const { service } = createService([
      row('2026-10-05', '대체공휴일(개천절)'),
      row('2026-10-09', '한글날'),
    ]);

    await expect(
      service.list({ from: '2026-10-01', to: '2026-12-31' }),
    ).resolves.toEqual([
      { date: '2026-10-05', name: '대체공휴일(개천절)' },
      { date: '2026-10-09', name: '한글날' },
    ]);
  });

  it('queries an inclusive [from, to] range ordered by date', async () => {
    const { service, findMany } = createService();

    await service.list({ from: '2026-10-01', to: '2026-10-31' });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-10-01T00:00:00.000Z'),
          lte: new Date('2026-10-31T00:00:00.000Z'),
        },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('defaults to today in KST for 400 days', async () => {
    const { service, findMany } = createService();

    // 2026-10-03T16:00Z 는 한국 시간으로 2026-10-04 01:00
    await service.list({}, new Date('2026-10-03T16:00:00.000Z'));

    const [args] = findMany.mock.calls[0] as [
      { where: { date: { gte: Date; lte: Date } } },
    ];
    const { where } = args;
    expect(where.date.gte).toEqual(new Date('2026-10-04T00:00:00.000Z'));
    expect(where.date.lte).toEqual(new Date('2027-11-08T00:00:00.000Z'));
  });

  it('rejects a range where to is before from', async () => {
    const { service } = createService();

    await expect(
      service.list({ from: '2026-12-01', to: '2026-11-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
