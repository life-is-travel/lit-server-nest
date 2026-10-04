import {
  parseSpecialDayResponse,
  PublicHolidaysSyncService,
} from './public-holidays-sync.service';

const wrap = (items: unknown, totalCount = 1, resultCode = '00') => ({
  response: {
    header: {
      resultCode,
      resultMsg: resultCode === '00' ? 'NORMAL SERVICE.' : 'ERROR',
    },
    body: { items, numOfRows: 100, pageNo: 1, totalCount },
  },
});

const holiday = (locdate: number, dateName: string, isHoliday = 'Y') => ({
  dateKind: '01',
  dateName,
  isHoliday,
  locdate,
  seq: 1,
});

describe('parseSpecialDayResponse', () => {
  it('parses an item array into YYYY-MM-DD dates', () => {
    const result = parseSpecialDayResponse(
      wrap(
        {
          item: [holiday(20261003, '개천절'), holiday(20261005, '대체공휴일')],
        },
        2,
      ),
    );

    expect(result.items).toEqual([
      { date: '2026-10-03', name: '개천절' },
      { date: '2026-10-05', name: '대체공휴일' },
    ]);
    expect(result.totalCount).toBe(2);
  });

  it('accepts a single item returned as an object', () => {
    const result = parseSpecialDayResponse(
      wrap({ item: holiday(20261009, '한글날') }),
    );

    expect(result.items).toEqual([{ date: '2026-10-09', name: '한글날' }]);
  });

  it('treats an empty-string items node (no results) as empty', () => {
    expect(parseSpecialDayResponse(wrap('', 0))).toEqual({
      items: [],
      totalCount: 0,
    });
    expect(parseSpecialDayResponse({ response: { body: {} } }).items).toEqual(
      [],
    );
  });

  it('keeps only isHoliday=Y and well-formed locdate', () => {
    const result = parseSpecialDayResponse(
      wrap(
        {
          item: [
            holiday(20261003, '개천절'),
            holiday(20261024, '국군의 날', 'N'),
            holiday(2026, '이상한 날짜'),
          ],
        },
        3,
      ),
    );

    expect(result.items).toEqual([{ date: '2026-10-03', name: '개천절' }]);
  });

  it('throws on a non-00 resultCode', () => {
    expect(() => parseSpecialDayResponse(wrap('', 0, '30'))).toThrow(
      /resultCode=30/,
    );
  });
});

describe('PublicHolidaysSyncService', () => {
  const createService = (key: string | undefined) => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { public_holidays: { upsert } };
    const config = { get: jest.fn().mockReturnValue(key) };
    const service = new PublicHolidaysSyncService(
      prisma as never,
      config as never,
    );
    return { service, upsert };
  };

  const mockFetch = (
    handler: (url: string) => { ok?: boolean; status?: number; body: string },
  ) =>
    jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const { ok = true, status = 200, body } = handler(url);
      return Promise.resolve({
        ok,
        status,
        text: () => Promise.resolve(body),
      } as Response);
    });

  afterEach(() => jest.restoreAllMocks());

  it('skips without a service key and never calls the API', async () => {
    const { service, upsert } = createService(undefined);
    const fetchSpy = mockFetch(() => ({ body: '{}' }));

    await expect(service.syncCurrentAndNextYear()).resolves.toEqual({
      skipped: true,
      years: [],
      upserted: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('fetches the KST current and next year and upserts each holiday', async () => {
    const { service, upsert } = createService('PLAIN_KEY');
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url);
      const year = new URL(url).searchParams.get('solYear');
      return {
        body: JSON.stringify(
          wrap({ item: holiday(Number(`${year}1009`), '한글날') }),
        ),
      };
    });

    // 2026-12-31T16:00Z 는 한국 시간으로 2027-01-01 → 2027, 2028
    const result = await service.syncCurrentAndNextYear(
      new Date('2026-12-31T16:00:00.000Z'),
    );

    expect(result).toEqual({
      skipped: false,
      years: [2027, 2028],
      upserted: 2,
    });
    expect(urls.map((u) => new URL(u).searchParams.get('solYear'))).toEqual([
      '2027',
      '2028',
    ]);
    expect(upsert).toHaveBeenCalledWith({
      where: { date: new Date('2027-10-09T00:00:00.000Z') },
      create: { date: new Date('2027-10-09T00:00:00.000Z'), name: '한글날' },
      update: { name: '한글날' },
    });
  });

  it('re-encodes an already-encoded key instead of double-encoding it', async () => {
    const { service } = createService('abc%2Bdef%3D%3D');
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url);
      return { body: JSON.stringify(wrap('', 0)) };
    });

    await service.syncCurrentAndNextYear();

    expect(urls[0]).toContain('serviceKey=abc%2Bdef%3D%3D&');
    expect(urls[0]).not.toContain('%252B');
  });

  it('follows pagination until totalCount is covered', async () => {
    const { service, upsert } = createService('K');
    let calls = 0;
    mockFetch((url) => {
      calls += 1;
      const page = Number(new URL(url).searchParams.get('pageNo'));
      return {
        body: JSON.stringify(
          wrap({ item: holiday(20260100 + page, `휴일${page}`) }, 150),
        ),
      };
    });

    await service.syncCurrentAndNextYear(new Date('2026-06-01T00:00:00.000Z'));

    // 연도당 150건 → 2페이지씩 × 2개 연도
    expect(calls).toBe(4);
    expect(upsert).toHaveBeenCalledTimes(4);
  });

  it('throws on HTTP errors and on a non-JSON (XML) error body, without writing', async () => {
    const { service, upsert } = createService('K');

    mockFetch(() => ({ ok: false, status: 500, body: '' }));
    await expect(service.syncCurrentAndNextYear()).rejects.toThrow(/HTTP 500/);

    jest.restoreAllMocks();
    mockFetch(() => ({
      body: '<OpenAPI_ServiceResponse><returnReasonCode>30</returnReasonCode></OpenAPI_ServiceResponse>',
    }));
    await expect(service.syncCurrentAndNextYear()).rejects.toThrow(
      /JSON이 아닌 응답/,
    );

    expect(upsert).not.toHaveBeenCalled();
  });

  it('handleCron swallows failures so the server keeps running', async () => {
    const { service } = createService('K');
    mockFetch(() => ({ ok: false, status: 503, body: '' }));

    await expect(service.handleCron()).resolves.toBeUndefined();
  });
});
