import {
  Body,
  Controller,
  Delete,
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
import { CreateStaffDto, ListStaffQueryDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

/** 점주 전용 직원 관리(F-024). @StaffAllowed가 없으므로 직원 토큰은 403 OWNER_ONLY. */
@ApiTags('Store Staff')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/store/staff')
export class StoreStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: '직원 목록을 조회합니다.' })
  @ApiOkResponse()
  list(@CurrentStoreId() storeId: string, @Query() query: ListStaffQueryDto) {
    return this.staffService.listStaff(storeId, query.includeRevoked ?? false);
  }

  @Post()
  @ApiOperation({ summary: '직원을 등록하고 초대코드를 발급합니다.' })
  @ApiOkResponse()
  create(@CurrentStoreId() storeId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.createStaff(storeId, dto);
  }

  @Post(':id/invite-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '직원 초대코드를 재발급합니다.' })
  @ApiOkResponse()
  reissue(@CurrentStoreId() storeId: string, @Param('id') staffId: string) {
    return this.staffService.reissueInviteCode(storeId, staffId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '직원을 해제합니다(세션 즉시 차단).' })
  @ApiOkResponse()
  async revoke(
    @CurrentStoreId() storeId: string,
    @Param('id') staffId: string,
  ) {
    await this.staffService.revokeStaff(storeId, staffId);
    return { message: '직원을 해제했습니다.' };
  }
}
