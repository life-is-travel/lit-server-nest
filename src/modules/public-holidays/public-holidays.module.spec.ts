import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../common/database/prisma.module';
import { PrismaService } from '../../common/database/prisma.service';
import { PublicHolidaysController } from './public-holidays.controller';
import { PublicHolidaysModule } from './public-holidays.module';
import { PublicHolidaysSyncService } from './public-holidays-sync.service';

describe('PublicHolidaysModule wiring', () => {
  it('resolves the controller and the sync service from the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        PublicHolidaysModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ public_holidays: { findMany: jest.fn(), upsert: jest.fn() } })
      .compile();

    expect(moduleRef.get(PublicHolidaysController)).toBeDefined();
    expect(moduleRef.get(PublicHolidaysSyncService)).toBeDefined();
  });
});
