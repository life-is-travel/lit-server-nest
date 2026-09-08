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
  UpdateLuggageOwnerMemoDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto';
// TODO(F-016): 아래 DTO 임포트는 lit-store 앱 배포 시 주석 해제
// import { QrCheckinDto, QrCheckinResponseDto, QrCheckoutDto, QrCheckoutResponseDto } from './dto/qr-checkin.dto';
import { QrCheckinService } from './services/qr-checkin.service';
import { ReservationCommandService } from './services/reservation-command.service';
import { ReservationNoShowService } from './services/reservation-no-show.service';
import { ReservationQueryService } from './services/reservation-query.service';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(StoreAuthGuard)
@Controller('api/reservations')
export class ReservationsController {
  constructor(
    private readonly reservationQueryService: ReservationQueryService,
    private readonly reservationCommandService: ReservationCommandService,
    private readonly reservationNoShowService: ReservationNoShowService,
    private readonly qrCheckinService: QrCheckinService,
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

  @Put(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '매장 예약을 노쇼 처리합니다 (보관 시작 시각 경과 후에만).',
  })
  @ApiOkResponse({ type: ReservationStatusResponseDto })
  async markNoShow(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
  ): Promise<ReservationStatusResponseDto> {
    const { id: reservationId, status } =
      await this.reservationNoShowService.markNoShow(id, { storeId });
    return { id: reservationId, status };
  }

  @Put(':id/luggage-owner-memo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '점주가 짐 확인 메모를 저장합니다.' })
  setLuggageOwnerMemo(
    @CurrentStoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLuggageOwnerMemoDto,
  ) {
    return this.reservationCommandService.setLuggageOwnerMemo(
      storeId,
      id,
      dto.memo,
    );
  }

  // TODO(F-016): lit-store 앱 배포 시 아래 두 엔드포인트 주석 해제로 활성화
  // @Post('checkin-by-token')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'QR 코드 토큰으로 체크인합니다.' })
  // @ApiOkResponse({ type: QrCheckinResponseDto })
  // checkinByToken(
  //   @CurrentStoreId() storeId: string,
  //   @Body() dto: QrCheckinDto,
  // ) {
  //   return this.qrCheckinService.checkinByToken(storeId, dto);
  // }

  // @Post('checkout-by-token')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'QR 코드 토큰으로 체크아웃합니다.' })
  // @ApiOkResponse({ type: QrCheckoutResponseDto })
  // checkoutByToken(
  //   @CurrentStoreId() storeId: string,
  //   @Body() dto: QrCheckoutDto,
  // ) {
  //   return this.qrCheckinService.checkoutByToken(storeId, dto);
  // }
}
