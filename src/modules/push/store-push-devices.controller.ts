import {
  Body,
  Controller,
  Delete,
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
import type { AuthenticatedStore } from '../auth/guards/store-auth.guard';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import {
  RegisterPushDeviceDto,
  UnregisterPushDeviceDto,
} from './dto/push-device.dto';
import { StorePushService } from './store-push.service';

/** 매장 앱 푸시 기기 등록·해제. 직원도 새 예약·취소 알림을 받으므로 둘 다 허용한다. */
@ApiTags('Store Push Devices')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/store/push-devices')
export class StorePushDevicesController {
  constructor(private readonly storePushService: StorePushService) {}

  @Post()
  @StaffAllowed()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이 기기의 푸시 토큰을 등록합니다.' })
  @ApiOkResponse()
  async register(
    @CurrentStore() actor: AuthenticatedStore,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    await this.storePushService.registerDevice(
      actor,
      dto.pushToken,
      dto.platform,
    );
    return { message: '푸시 기기를 등록했습니다.' };
  }

  @Delete()
  @StaffAllowed()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이 기기의 푸시 토큰을 해제합니다.' })
  @ApiOkResponse()
  async unregister(
    @CurrentStore() actor: AuthenticatedStore,
    @Body() dto: UnregisterPushDeviceDto,
  ) {
    await this.storePushService.unregisterDevice(actor.storeId, dto.pushToken);
    return { message: '푸시 기기를 해제했습니다.' };
  }
}
