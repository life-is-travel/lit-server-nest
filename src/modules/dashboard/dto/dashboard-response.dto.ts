import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardStatsPeriod } from './dashboard-query.dto';

export class DashboardSummaryResponseDto {
  @ApiProperty()
  storeName!: string;

  @ApiProperty()
  totalReservations!: number;

  @ApiProperty()
  pendingReservations!: number;

  @ApiProperty()
  activeReservations!: number;

  @ApiProperty()
  completedReservations!: number;

  @ApiProperty()
  todayReservations!: number;

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  todayRevenue!: number;

  @ApiProperty()
  totalStorages!: number;

  @ApiProperty()
  availableStorages!: number;

  @ApiProperty()
  occupiedStorages!: number;

  @ApiProperty()
  occupancyRate!: number;

  @ApiPropertyOptional()
  createdAt?: Date | null;

  @ApiPropertyOptional()
  updatedAt?: Date | null;
}

export class DashboardStatsRevenueDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  average!: number;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  growth!: number;
}

export class DashboardStatsReservationsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  cancelled!: number;

  @ApiProperty()
  completionRate!: number;
}

export class DashboardStatsOccupancyDto {
  @ApiProperty({ example: '0.25' })
  average!: string;

  @ApiProperty()
  peak!: number;

  @ApiPropertyOptional({ nullable: true })
  peakTime!: Date | null;
}

export class DashboardCustomerSatisfactionDto {
  @ApiProperty({ example: '4.5' })
  averageRating!: string;

  @ApiProperty()
  totalReviews!: number;

  @ApiProperty()
  responseRate!: number;
}

export class DashboardStatsResponseDto {
  @ApiProperty({ enum: DashboardStatsPeriod })
  period!: DashboardStatsPeriod;

  @ApiProperty({ type: DashboardStatsRevenueDto })
  revenue!: DashboardStatsRevenueDto;

  @ApiProperty({ type: DashboardStatsReservationsDto })
  reservations!: DashboardStatsReservationsDto;

  @ApiProperty({ type: DashboardStatsOccupancyDto })
  occupancy!: DashboardStatsOccupancyDto;

  @ApiProperty({ type: DashboardCustomerSatisfactionDto })
  customerSatisfaction!: DashboardCustomerSatisfactionDto;
}

export class DashboardRealtimeResponseDto {
  @ApiProperty()
  storeStatus!: string;

  @ApiProperty()
  activeReservations!: number;

  @ApiProperty()
  pendingReservations!: number;

  @ApiProperty()
  todayRevenue!: number;

  @ApiProperty()
  occupiedStorages!: number;

  @ApiProperty()
  availableStorages!: number;

  @ApiProperty()
  unreadNotifications!: number;

  @ApiProperty()
  lastUpdated!: Date;
}
