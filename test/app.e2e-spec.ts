import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from './../src/common/database/prisma.service';
import { AppModule } from './../src/app.module';
import { ApiResponseInterceptor } from './../src/common/interceptors/api-response.interceptor';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
          data: {
            status: 'ok',
            uptime: expect.any(Number) as number,
            environment: 'test',
          },
          timestamp: expect.any(String) as string,
        });
      });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
