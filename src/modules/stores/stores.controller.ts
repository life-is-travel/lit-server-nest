import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import {
  CheckStorePinResponseDto,
  SetStorePinResponseDto,
  StorePinDto,
} from './dto/store-pin.dto';
import {
  StoreProfileResponseDto,
  UpdateStoreProfileDto,
} from './dto/store-profile.dto';
import {
  StoreSettingsResponseDto,
  UpdateStoreSettingsDto,
} from './dto/store-settings.dto';
import { UpdateStoreStatusDto } from './dto/store-status.dto';
import { StorePinService } from './services/store-pin.service';
import { StoreSettingsService } from './services/store-settings.service';
import { StoreStatusService } from './services/store-status.service';
import { StoresService } from './stores.service';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/store')
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly storeStatusService: StoreStatusService,
    private readonly storeSettingsService: StoreSettingsService,
    private readonly storePinService: StorePinService,
  ) {}

  @Get()
  @ApiOperation({ summary: '인증된 매장의 기본 정보를 조회합니다.' })
  @ApiOkResponse({ type: StoreProfileResponseDto })
  getProfile(@CurrentStoreId() storeId: string) {
    return this.storesService.getProfile(storeId);
  }

  @Put()
  @ApiOperation({ summary: '인증된 매장의 기본 정보를 수정합니다.' })
  @ApiOkResponse({ type: StoreProfileResponseDto })
  updateProfile(
    @CurrentStoreId() storeId: string,
    @Body() dto: UpdateStoreProfileDto,
  ) {
    return this.storesService.updateProfile(storeId, dto);
  }

  @Get('status')
  @ApiOperation({ summary: '매장 영업 상태를 조회합니다.' })
  @ApiOkResponse()
  getStatus(@CurrentStoreId() storeId: string) {
    return this.storeStatusService.getStatus(storeId);
  }

  @Put('status')
  @ApiOperation({ summary: '매장 영업 상태를 변경합니다.' })
  @ApiOkResponse()
  updateStatus(
    @CurrentStoreId() storeId: string,
    @Body() dto: UpdateStoreStatusDto,
  ) {
    return this.storeStatusService.updateStatus(storeId, dto);
  }

  @Post('open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 상태를 영업중으로 변경합니다.' })
  @ApiOkResponse()
  openStore(@CurrentStoreId() storeId: string) {
    return this.storeStatusService.openStore(storeId);
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 상태를 영업 종료로 변경합니다.' })
  @ApiOkResponse()
  closeStore(@CurrentStoreId() storeId: string) {
    return this.storeStatusService.closeStore(storeId);
  }

  @Get('settings')
  @ApiOperation({ summary: '매장 설정을 조회합니다.' })
  @ApiOkResponse({ type: StoreSettingsResponseDto })
  getSettings(@CurrentStoreId() storeId: string) {
    return this.storeSettingsService.getSettings(storeId);
  }

  @Put('settings')
  @ApiOperation({ summary: '매장 설정을 수정합니다.' })
  @ApiOkResponse({ type: StoreSettingsResponseDto })
  updateSettings(
    @CurrentStoreId() storeId: string,
    @Body() dto: UpdateStoreSettingsDto,
  ) {
    return this.storeSettingsService.updateSettings(storeId, dto);
  }

  @Put('pin')
  @ApiOperation({ summary: '매장 PIN을 해시로 저장 또는 변경합니다.' })
  @ApiOkResponse({ type: SetStorePinResponseDto })
  setPin(@CurrentStoreId() storeId: string, @Body() dto: StorePinDto) {
    return this.storePinService.setPin(storeId, dto);
  }

  @Post('pin/check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: '매장 PIN 일치 여부를 확인합니다.' })
  @ApiOkResponse({ type: CheckStorePinResponseDto })
  checkPin(@CurrentStoreId() storeId: string, @Body() dto: StorePinDto) {
    return this.storePinService.checkPin(storeId, dto);
  }
}
