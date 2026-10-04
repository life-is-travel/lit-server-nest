import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../common/database/prisma.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { PublicHolidaysController } from './public-holidays.controller';
import { PublicHolidaysService } from './public-holidays.service';

describe('PublicHolidaysController (HTTP)', () => {
  let app: INestApplication;
  const findMany = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicHolidaysController],
      providers: [
        PublicHolidaysService,
        { provide: PrismaService, useValue: { public_holidays: { findMany } } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // main.ts와 같은 전역 설정
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => findMany.mockReset());

  it('GET returns wrapped holiday list with a 1h public cache header, no auth', async () => {
    findMany.mockResolvedValue([
      {
        date: new Date('2026-10-05T00:00:00.000Z'),
        name: '대체공휴일(개천절)',
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/customer/public-holidays?from=2026-10-01&to=2026-12-31')
      .expect(200);

    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.body).toMatchObject({
      success: true,
      data: [{ date: '2026-10-05', name: '대체공휴일(개천절)' }],
    });
  });

  it('GET without query uses the default range', async () => {
    findMany.mockResolvedValue([]);

    const res = await request(app.getHttpServer())
      .get('/api/customer/public-holidays')
      .expect(200);

    expect(res.body).toMatchObject({ success: true, data: [] });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed date and unknown query params with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/customer/public-holidays?from=2026-13-45')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/customer/public-holidays?year=2026')
      .expect(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects to before from with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/customer/public-holidays?from=2026-12-01&to=2026-11-01')
      .expect(400);
  });
});
