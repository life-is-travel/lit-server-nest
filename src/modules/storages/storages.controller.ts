import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
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
import { ListStoragesQueryDto } from './dto/list-storages-query.dto';
import {
  DeleteStorageResponseDto,
  StorageListResponseDto,
  StorageResponseDto,
  UpdateStorageDto,
} from './dto/storage.dto';
import { StoragesCommandService } from './services/storages-command.service';
import { StoragesQueryService } from './services/storages-query.service';

@ApiTags('Storages')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/storages')
export class StoragesController {
  constructor(
    private readonly storagesQueryService: StoragesQueryService,
    private readonly storagesCommandService: StoragesCommandService,
  ) {}

  @Get()
  @ApiOperation({ summary: '매장의 보관함 목록을 조회합니다.' })
  @ApiOkResponse({ type: StorageListResponseDto })
  listStorages(
    @CurrentStoreId() storeId: string,
    @Query() query: ListStoragesQueryDto,
  ) {
    return this.storagesQueryService.listStorages(storeId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '매장의 보관함 상세 정보를 조회합니다.' })
  @ApiOkResponse({ type: StorageResponseDto })
  getStorage(@CurrentStoreId() storeId: string, @Param('id') id: string) {
    return this.storagesQueryService.getStorage(storeId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: '매장 보관함을 수정합니다.' })
  @ApiOkResponse({ type: StorageResponseDto })
  updateStorage(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStorageDto,
  ) {
    return this.storagesCommandService.updateStorage(storeId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '매장 보관함을 비활성화합니다.',
    description:
      '예약 이력 보존을 위해 물리 삭제하지 않고 maintenance 상태로 전환합니다.',
  })
  @ApiOkResponse({ type: DeleteStorageResponseDto })
  deleteStorage(@CurrentStoreId() storeId: string, @Param('id') id: string) {
    return this.storagesCommandService.deleteStorage(storeId, id);
  }
}
