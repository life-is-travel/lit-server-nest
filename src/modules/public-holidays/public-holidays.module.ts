import { Module } from '@nestjs/common';
import { PublicHolidaysController } from './public-holidays.controller';
import { PublicHolidaysSyncService } from './public-holidays-sync.service';
import { PublicHolidaysService } from './public-holidays.service';

@Module({
  controllers: [PublicHolidaysController],
  providers: [PublicHolidaysService, PublicHolidaysSyncService],
})
export class PublicHolidaysModule {}
