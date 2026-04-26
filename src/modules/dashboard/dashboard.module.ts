import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRealtimeService } from './services/dashboard-realtime.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { DashboardStoreService } from './services/dashboard-store.service';
import { DashboardSummaryService } from './services/dashboard-summary.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [
    DashboardStoreService,
    DashboardSummaryService,
    DashboardStatsService,
    DashboardRealtimeService,
  ],
})
export class DashboardModule {}
