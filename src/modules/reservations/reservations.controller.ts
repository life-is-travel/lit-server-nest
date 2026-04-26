import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import {
  CreateReservationDto,
  ListStoreReservationsQueryDto,
  ReservationListResponseDto,
  ReservationResponseDto,
  ReservationStatusResponseDto,
  StoreCheckinDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto';
import { ReservationCommandService } from './services/reservation-command.service';
import { ReservationQueryService } from './services/reservation-query.service';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/reservations')
export class ReservationsController {
  constructor(
    private readonly reservationQueryService: ReservationQueryService,
    private readonly reservationCommandService: ReservationCommandService,
  ) {}

  @Post()
  @ApiOperation({ summary: '매장 예약을 생성합니다.' })
  @ApiCreatedResponse({ type: ReservationResponseDto })
  createReservation(
    @CurrentStoreId() storeId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationCommandService.createStoreReservation(storeId, dto);
  }

  @Get()
  @ApiOperation({ summary: '매장 예약 목록을 조회합니다.' })
  @ApiOkResponse({ type: ReservationListResponseDto })
  getReservations(
    @CurrentStoreId() storeId: string,
    @Query() query: ListStoreReservationsQueryDto,
  ) {
    return this.reservationQueryService.listStoreReservations(storeId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '매장 예약 상세를 조회합니다.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  getReservation(@CurrentStoreId() storeId: string, @Param('id') id: string) {
    return this.reservationQueryService.getStoreReservation(storeId, id);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 예약을 승인하고 보관함을 배정합니다.' })
  @ApiOkResponse({ type: ReservationStatusResponseDto })
  approveReservation(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
  ) {
    return this.reservationCommandService.approveReservation(storeId, id);
  }

  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 예약을 거절합니다.' })
  @ApiOkResponse({ type: ReservationStatusResponseDto })
  rejectReservation(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
  ) {
    return this.reservationCommandService.rejectReservation(storeId, id);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 예약을 취소합니다.' })
  @ApiOkResponse({ type: ReservationStatusResponseDto })
  cancelReservation(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
  ) {
    return this.reservationCommandService.cancelReservation(storeId, id);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 예약 상태를 변경합니다.' })
  @ApiOkResponse({ type: ReservationStatusResponseDto })
  updateReservationStatus(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    const status = this.reservationCommandService.normalizeStatus(dto.status);

    return this.reservationCommandService.updateReservationStatus(
      storeId,
      id,
      status,
    );
  }

  @Put(':id/checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 예약 체크인을 완료합니다.' })
  @ApiOkResponse({ type: ReservationStatusResponseDto })
  storeCheckin(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: StoreCheckinDto,
  ) {
    return this.reservationCommandService.storeCheckin(storeId, id, dto);
  }
}
