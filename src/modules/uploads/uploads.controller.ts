import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { StoreAuthGuard } from '../auth/guards/store-auth.guard';
import { CurrentCustomerId } from '../auth/decorators/current-customer.decorator';
import { CurrentStoreId } from '../auth/decorators/current-store.decorator';
import {
  GuestPresignUploadRequestDto,
  PresignUploadRequestDto,
  PresignUploadResponseDto,
} from './dto/presign-upload.dto';
import { UploadsService } from './uploads.service';
import { StaffAllowed } from '../auth/decorators/staff-allowed.decorator';

@ApiTags('Uploads')
@Controller()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * lit-store 앱(매장 직원)용 presigned PUT URL 발급.
   * 클라이언트는 반환된 uploadUrl로 직접 R2에 PUT 요청을 보내 파일을 업로드합니다.
   */
  @Post('api/uploads/presign')
  @UseGuards(StoreAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '(매장용) R2 presigned PUT URL 발급',
    description:
      '매장 앱이 직접 Cloudflare R2에 파일을 업로드할 수 있는 PUT presigned URL을 발급합니다. URL은 5분간 유효합니다.',
  })
  @ApiCreatedResponse({ type: PresignUploadResponseDto })
  @StaffAllowed()
  presignForStore(
    @CurrentStoreId() storeId: string | undefined,
    @Body() dto: PresignUploadRequestDto,
  ): Promise<PresignUploadResponseDto> {
    return this.uploadsService.presign(storeId ?? 'unknown_store', dto);
  }

  /**
   * 비회원(게스트)용 presigned PUT URL 발급.
   * 인증 없이 호출 가능하며, reservations/ 폴더만 허용합니다.
   * 무인증 엔드포인트이므로 IP 기준 rate-limit으로 스토리지 남용을 차단합니다.
   */
  @Post('api/guest/uploads/presign')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '(비회원용) R2 presigned PUT URL 발급',
    description:
      '비회원이 짐 사진을 직접 Cloudflare R2에 업로드할 수 있는 PUT presigned URL을 발급합니다. ' +
      'reservations/ 폴더만 허용됩니다. URL은 5분간 유효합니다.',
  })
  @ApiCreatedResponse({ type: PresignUploadResponseDto })
  presignForGuest(
    @Body() dto: GuestPresignUploadRequestDto,
  ): Promise<PresignUploadResponseDto> {
    return this.uploadsService.presign('guest', dto);
  }

  /**
   * lit-customer 앱(고객)용 presigned PUT URL 발급.
   * 미래 고객 앱 출시 시 사용합니다.
   */
  @Post('api/customer/uploads/presign')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '(고객용) R2 presigned PUT URL 발급',
    description:
      '고객 앱이 직접 Cloudflare R2에 파일을 업로드할 수 있는 PUT presigned URL을 발급합니다. URL은 5분간 유효합니다.',
  })
  @ApiCreatedResponse({ type: PresignUploadResponseDto })
  presignForCustomer(
    @CurrentCustomerId() customerId: string | undefined,
    @Body() dto: PresignUploadRequestDto,
  ): Promise<PresignUploadResponseDto> {
    return this.uploadsService.presign(customerId ?? 'unknown_customer', dto);
  }
}
