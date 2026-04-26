import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum DashboardStatsPeriod {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export class DashboardStatsQueryDto {
  @ApiPropertyOptional({
    enum: DashboardStatsPeriod,
    default: DashboardStatsPeriod.Monthly,
  })
  @IsOptional()
  @IsEnum(DashboardStatsPeriod)
  period: DashboardStatsPeriod = DashboardStatsPeriod.Monthly;
}
