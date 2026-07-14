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
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import { DeletePushTokenDto, RegisterPushTokenDto } from './dto/push-token.dto';
import { PushTokensService } from './push-tokens.service';

@ApiTags('Store Push Tokens')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/store/push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '점주 앱 FCM 푸시 토큰 등록/갱신 (lit-store 앱)' })
  @ApiOkResponse()
  register(
    @CurrentStoreId() storeId: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.pushTokensService.register(storeId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '점주 앱 FCM 푸시 토큰 삭제 (로그아웃)' })
  @ApiOkResponse()
  remove(@Body() dto: DeletePushTokenDto) {
    return this.pushTokensService.remove(dto);
  }
}
