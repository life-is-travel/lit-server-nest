import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentStore,
  CurrentStoreId,
} from '../auth/decorators/current-store.decorator';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import { DashboardStatsQueryDto } from './dto/dashboard-query.dto';
import {
  DashboardRealtimeResponseDto,
  DashboardStatsResponseDto,
  DashboardSummaryResponseDto,
} from './dto/dashboard-response.dto';
import { DashboardRealtimeService } from './services/dashboard-realtime.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { DashboardSummaryService } from './services/dashboard-summary.service';
import { StaffAllowed } from '../auth/decorators/staff-allowed.decorator';
import type { AuthenticatedStore } from '../auth/guards/store-auth.guard';
import { hideRevenueForStaff } from '../auth/utils/staff-view.util';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardSummaryService: DashboardSummaryService,
    private readonly dashboardStatsService: DashboardStatsService,
    private readonly dashboardRealtimeService: DashboardRealtimeService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: '기존 Express 호환 대시보드 요약을 조회합니다.' })
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  @StaffAllowed()
  async getSummary(
    @CurrentStoreId() storeId: string,
    @CurrentStore() actor?: AuthenticatedStore,
  ) {
    const summary = await this.dashboardSummaryService.getSummary(storeId);
    return hideRevenueForStaff(actor, summary, [
      'totalRevenue',
      'todayRevenue',
    ]);
  }

  @Get('stats')
  @ApiOperation({
    summary: '기존 Express 호환 기간별 대시보드 통계를 조회합니다.',
  })
  @ApiOkResponse({ type: DashboardStatsResponseDto })
  getStats(
    @CurrentStoreId() storeId: string,
    @Query() query: DashboardStatsQueryDto,
  ) {
    return this.dashboardStatsService.getStats(storeId, query);
  }

  @Get('realtime')
  @ApiOperation({ summary: '기존 Express 호환 실시간 대시보드를 조회합니다.' })
  @ApiOkResponse({ type: DashboardRealtimeResponseDto })
  @StaffAllowed()
  async getRealtime(
    @CurrentStoreId() storeId: string,
    @CurrentStore() actor?: AuthenticatedStore,
  ) {
    const realtime = await this.dashboardRealtimeService.getRealtime(storeId);
    return hideRevenueForStaff(actor, realtime, ['todayRevenue']);
  }
}
