import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStoreId } from './decorators/current-store.decorator';
import {
  OwnerSessionResponseDto,
  OwnerStoreSummaryDto,
} from './dto/auth-response.dto';
import { AddStoreDto, SwitchStoreDto } from './dto/owner-store.dto';
import { StoreAuthGuard } from './guards/store-auth.guard';
import { AuthService } from './auth.service';

/**
 * 점주 다매장(F-026). 로그인 레이트리밋(15분 5회)을 걸지 않는다 — 매장 전환은 잦다.
 * @StaffAllowed가 없으므로 직원 토큰은 403 OWNER_ONLY.
 */
@ApiTags('Owner Stores')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/auth/stores')
export class OwnerStoresController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ summary: '같은 점주의 열린 매장 목록을 조회합니다.' })
  @ApiOkResponse({ type: [OwnerStoreSummaryDto] })
  list(@CurrentStoreId() storeId: string) {
    return this.authService.listOwnerStores(storeId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '같은 점주 아래 매장을 추가하고 그 매장 토큰을 발급합니다.',
  })
  @ApiOkResponse({ type: OwnerSessionResponseDto })
  add(@CurrentStoreId() storeId: string, @Body() dto: AddStoreDto) {
    return this.authService.addStore(storeId, dto);
  }

  @Post(':storeId/session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '같은 점주의 다른 매장으로 전환합니다(그 매장 토큰 발급).',
  })
  @ApiOkResponse({ type: OwnerSessionResponseDto })
  switch(
    @CurrentStoreId() storeId: string,
    @Param('storeId') targetStoreId: string,
    @Body() dto: SwitchStoreDto,
  ) {
    return this.authService.switchStore(
      storeId,
      targetStoreId,
      dto.refreshToken,
    );
  }
}
