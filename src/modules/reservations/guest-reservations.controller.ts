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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard';
import {
  CancelGuestReservationDto,
  CleanupExpiredGuestReservationsResponseDto,
  CreateGuestReservationDto,
  CreateGuestReservationResponseDto,
  GetGuestReservationQueryDto,
  GuestAvailabilityQueryDto,
  GuestAvailabilityResponseDto,
  GuestReservationCancelResponseDto,
  GuestReservationListResponseDto,
  GuestReservationResponseDto,
  ListGuestReservationsQueryDto,
} from './dto/guest-reservation.dto';
import { GuestReservationService } from './services/guest-reservation.service';

@ApiTags('Guest Reservations')
@UseGuards(AuthThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('api/guest/reservations')
export class GuestReservationsController {
  constructor(
    private readonly guestReservationService: GuestReservationService,
  ) {}

  @Post()
  @ApiOperation({ summary: '비회원 예약을 생성합니다.' })
  @ApiCreatedResponse({ type: CreateGuestReservationResponseDto })
  createReservation(@Body() dto: CreateGuestReservationDto) {
    return this.guestReservationService.createReservation(dto);
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: '만료된 비회원 미결제 예약을 정리합니다.' })
  @ApiOkResponse({ type: CleanupExpiredGuestReservationsResponseDto })
  cleanupExpiredReservations() {
    return this.guestReservationService.cleanupExpiredReservations();
  }

  @Get('availability')
  @ApiOperation({ summary: '비회원 예약 가능 수량을 조회합니다.' })
  @ApiOkResponse({ type: GuestAvailabilityResponseDto })
  getAvailability(@Query() query: GuestAvailabilityQueryDto) {
    return this.guestReservationService.getAvailability(query);
  }

  @Get()
  @ApiOperation({ summary: '전화번호 기반 비회원 예약 목록을 조회합니다.' })
  @ApiOkResponse({ type: GuestReservationListResponseDto })
  getReservations(@Query() query: ListGuestReservationsQueryDto) {
    return this.guestReservationService.listReservations(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '토큰 기반 비회원 예약 상세를 조회합니다.' })
  @ApiOkResponse({ type: GuestReservationResponseDto })
  getReservation(
    @Param('id') id: string,
    @Query() query: GetGuestReservationQueryDto,
  ) {
    return this.guestReservationService.getReservation(id, query);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '비회원 예약을 전화번호 검증 후 취소합니다.' })
  @ApiOkResponse({ type: GuestReservationCancelResponseDto })
  cancelReservation(
    @Param('id') id: string,
    @Body() dto: CancelGuestReservationDto,
  ) {
    return this.guestReservationService.cancelReservation(id, dto);
  }
}
