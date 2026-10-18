import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { StaffAllowed } from '../auth/decorators/staff-allowed.decorator';
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard';
import type { AuthenticatedStore } from '../auth/guards/store-auth.guard';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import { RedeemInviteCodeDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

/** 직원 시작·나가기(F-024). 레이트리밋은 인증 API와 같다. */
@ApiTags('Staff Auth')
@UseGuards(AuthThrottlerGuard)
@Controller('api/auth/staff')
export class StaffAuthController {
  constructor(private readonly staffService: StaffService) {}

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '초대코드로 직원 세션을 시작합니다.' })
  @ApiOkResponse()
  redeem(@Body() dto: RedeemInviteCodeDto) {
    return this.staffService.redeem(dto);
  }

  @Post('leave')
  @StaffAllowed()
  @UseGuards(StoreAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '직원이 매장에서 스스로 나갑니다.' })
  @ApiOkResponse()
  async leave(@CurrentStore() actor: AuthenticatedStore) {
    if (actor.role !== 'staff' || !actor.staffId) {
      throw new ForbiddenException({
        code: 'STAFF_ONLY',
        message: '직원만 사용할 수 있는 기능입니다.',
      });
    }

    await this.staffService.leave(actor.storeId, actor.staffId);
    return { message: '매장에서 나갔습니다.' };
  }
}
