import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import {
  ListStoreReviewsQueryDto,
  RespondToReviewDto,
} from './dto/store-review.dto';
import { StoreReviewService } from './services/store-review.service';
import { StaffAllowed } from '../auth/decorators/staff-allowed.decorator';

@ApiTags('Store Reviews')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/reviews')
export class StoreReviewsController {
  constructor(private readonly storeReviewService: StoreReviewService) {}

  @Get()
  @ApiOperation({ summary: '인증 매장의 리뷰 목록 (lit-store 앱 계약)' })
  @ApiOkResponse()
  @StaffAllowed()
  listReviews(
    @CurrentStoreId() storeId: string,
    @Query() query: ListStoreReviewsQueryDto,
  ) {
    return this.storeReviewService.listReviews(storeId, query);
  }

  @Get('statistics')
  @ApiOperation({ summary: '인증 매장의 리뷰 통계' })
  @ApiOkResponse()
  @StaffAllowed()
  getStatistics(@CurrentStoreId() storeId: string) {
    return this.storeReviewService.getStatistics(storeId);
  }

  @Post(':id/response')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '리뷰에 점주 답글 작성' })
  @ApiOkResponse()
  respondToReview(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: RespondToReviewDto,
  ) {
    return this.storeReviewService.respondToReview(storeId, id, dto.response);
  }
}
