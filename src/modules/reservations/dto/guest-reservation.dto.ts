import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  reservations_payment_status,
  reservations_requested_storage_type,
  reservations_status,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  emptyToUndefined,
  optionalDateString,
  optionalNumber,
} from '../../../common/transformers/legacy-input.transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RESERVATION_LOCALES } from '../reservation.constants';

export class GuestReservationItemRequestDto {
  @ApiProperty({ enum: reservations_requested_storage_type })
  @IsEnum(reservations_requested_storage_type)
  storageType!: reservations_requested_storage_type;

  @ApiProperty()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(10)
  bagCount!: number;
}

export class CreateGuestReservationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  storeId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  customerName!: string;

  @ApiProperty({
    description:
      '전화번호 또는 이메일(외국인 예약). 이메일만 사용 시 phoneNumber에도 동일 값을 넣습니다.',
  })
  @IsString()
  @MaxLength(255)
  phoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: '기존 랜딩 serializer 호환 필드입니다.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  customerEmail?: string;

  @ApiPropertyOptional({ default: 'ko', enum: RESERVATION_LOCALES })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(5)
  @IsIn(RESERVATION_LOCALES)
  locale?: string;

  @ApiProperty()
  @Transform(optionalDateString)
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalDateString)
  @IsDateString()
  endTime?: string;

  @ApiProperty()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  duration!: number;

  @ApiPropertyOptional({
    description: 'items 미제공 시 필수입니다 (단일 타입 호환 필드).',
  })
  @ValidateIf((o: CreateGuestReservationDto) => !o.items?.length)
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(10)
  bagCount?: number;

  @ApiPropertyOptional({ enum: reservations_requested_storage_type })
  @IsOptional()
  @IsEnum(reservations_requested_storage_type)
  storageType?: reservations_requested_storage_type;

  @ApiPropertyOptional({
    type: [GuestReservationItemRequestDto],
    description:
      '멀티타입 예약 항목입니다. 제공 시 storageType/bagCount 단일 필드는 무시됩니다.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => GuestReservationItemRequestDto)
  items?: GuestReservationItemRequestDto[];

  @ApiPropertyOptional({
    enum: reservations_requested_storage_type,
    description: '기존 랜딩 serializer 호환 필드입니다.',
  })
  @IsOptional()
  @IsEnum(reservations_requested_storage_type)
  requestedStorageType?: reservations_requested_storage_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentKey?: string;

  @ApiPropertyOptional({ description: 'snake_case 호환 필드입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  orderId?: string;

  @ApiPropertyOptional({ description: 'snake_case 호환 필드입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  order_id?: string;
}

export class ListGuestReservationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneNumber?: string;

  @ApiPropertyOptional({ description: '기존 호환 query 필드입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customer_phone?: string;

  @ApiPropertyOptional({
    description: '이메일로 예약 조회 (외국인 예약). phoneNumber와 둘 중 하나.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class GetGuestReservationQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  token!: string;
}

export class CancelGuestReservationDto {
  @ApiPropertyOptional({
    description: '전화번호 본인 확인. email과 둘 중 하나.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: '이메일 본인 확인. phoneNumber와 둘 중 하나.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class GuestAvailabilityQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  storeId!: string;

  @ApiProperty()
  @Transform(optionalDateString)
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  duration = 4;
}

export class GuestReservationStoreInfoDto {
  @ApiProperty()
  storeName!: string;

  @ApiPropertyOptional()
  storeAddress?: string | null;

  @ApiPropertyOptional()
  storePhone?: string | null;

  @ApiPropertyOptional()
  lat?: number | null;

  @ApiPropertyOptional()
  lng?: number | null;
}

export class GuestReservationItemDto {
  @ApiProperty({ enum: reservations_requested_storage_type })
  storageType!: reservations_requested_storage_type;

  @ApiProperty()
  bagCount!: number;

  @ApiProperty()
  amount!: number;
}

export class GuestReservationResponseDto extends GuestReservationStoreInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  storeId!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional({ example: 'ko' })
  locale?: string | null;

  @ApiProperty({ enum: reservations_status })
  status!: reservations_status | null;

  @ApiProperty()
  startTime!: Date;

  @ApiPropertyOptional()
  endTime?: Date | null;

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  bagCount!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiPropertyOptional()
  message?: string | null;

  @ApiPropertyOptional({ enum: reservations_requested_storage_type })
  storageType?: reservations_requested_storage_type | null;

  @ApiPropertyOptional({
    description:
      '같은 그룹(한 번에 생성된 멀티타입 예약)의 대표 예약 id입니다.',
  })
  groupId?: string | null;

  @ApiProperty({ type: [GuestReservationItemDto] })
  items!: GuestReservationItemDto[];

  @ApiPropertyOptional({ enum: reservations_payment_status })
  paymentStatus?: reservations_payment_status | null;

  @ApiPropertyOptional()
  accessToken?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date | null;
}

export class CreateGuestReservationResponseDto {
  @ApiProperty({ type: GuestReservationResponseDto })
  reservation!: GuestReservationResponseDto;

  @ApiProperty()
  storeName!: string;
}

export class GuestReservationListResponseDto {
  @ApiProperty({ type: [GuestReservationResponseDto] })
  items!: GuestReservationResponseDto[];

  @ApiProperty()
  total!: number;
}

export class CleanupExpiredGuestReservationsResponseDto {
  @ApiProperty()
  cancelledCount!: number;

  @ApiProperty()
  ttlMinutes!: number;
}

export class GuestReservationCancelResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: reservations_status })
  status!: reservations_status;

  @ApiPropertyOptional()
  groupId?: string;

  @ApiPropertyOptional({ description: '함께 취소된 예약 수입니다.' })
  cancelledCount?: number;
}

export class PatchLuggagePhotosDto {
  @ApiProperty({
    description: '업로드 완료된 짐 사진 URL 목록. 최대 10개.',
    type: [String],
    example: [
      'https://r2.example.com/reservations/2026-07/1751234567890-uuid.jpg',
    ],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  photoUrls!: string[];

  @ApiPropertyOptional({
    description: '본인 확인용 전화번호. email과 둘 중 하나를 제공해야 합니다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerPhone?: string;

  @ApiPropertyOptional({
    description: '본인 확인용 이메일. customerPhone과 둘 중 하나를 제공해야 합니다.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  customerEmail?: string;
}

export class PatchLuggagePhotosResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: [String],
    description: '병합 후 저장된 전체 짐 사진 URL 목록.',
  })
  luggageImageUrls!: string[];
}

export class GuestAvailabilityItemDto {
  @ApiProperty()
  maxCapacity!: number;

  @ApiProperty()
  currentCount!: number;

  @ApiProperty()
  remaining!: number;
}

export class GuestAvailabilityResponseDto {
  @ApiProperty()
  storeId!: string;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty()
  duration!: number;

  @ApiProperty({
    additionalProperties: { type: 'object' },
  })
  items!: Record<string, GuestAvailabilityItemDto>;
}
