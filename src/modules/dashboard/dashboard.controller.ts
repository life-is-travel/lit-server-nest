import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
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
  getSummary(@CurrentStoreId() storeId: string) {
    return this.dashboardSummaryService.getSummary(storeId);
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
  getRealtime(@CurrentStoreId() storeId: string) {
    return this.dashboardRealtimeService.getRealtime(storeId);
  }
}
