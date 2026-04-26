import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  reservations_payment_status,
  reservations_requested_storage_type,
  reservations_status,
} from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGuestReservationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  storeId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  customerName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: '기존 랜딩 serializer 호환 필드입니다.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  customerEmail?: string;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  duration!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10)
  bagCount!: number;

  @ApiPropertyOptional({ enum: reservations_requested_storage_type })
  @IsOptional()
  @IsEnum(reservations_requested_storage_type)
  storageType?: reservations_requested_storage_type;

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
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ description: '기존 호환 query 필드입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customer_phone?: string;
}

export class GetGuestReservationQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  token!: string;
}

export class CancelGuestReservationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phoneNumber!: string;
}

export class GuestAvailabilityQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  storeId!: string;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
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
