import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  reservations_payment_status,
  reservations_requested_storage_type,
  reservations_status,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  emptyToUndefined,
  optionalDateString,
  optionalNumber,
} from '../../../common/transformers/legacy-input.transformer';
import {
  ArrayMaxSize,
  IsArray,
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

export class ReservationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  storeId!: string;

  @ApiPropertyOptional()
  customerId?: string | null;

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
  requestTime!: Date;

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  bagCount!: number;

  @ApiProperty()
  price!: number;

  @ApiPropertyOptional()
  message?: string | null;

  @ApiPropertyOptional()
  storageId?: string | null;

  @ApiPropertyOptional()
  storageNumber?: string | null;

  @ApiPropertyOptional({ enum: reservations_requested_storage_type })
  storageType?: reservations_requested_storage_type | null;

  @ApiPropertyOptional()
  specialRequests?: string | null;

  @ApiPropertyOptional({ enum: reservations_payment_status })
  paymentStatus?: reservations_payment_status | null;

  @ApiPropertyOptional()
  paymentMethod?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date | null;
}

export class ReservationListResponseDto {
  @ApiProperty({ type: [ReservationResponseDto] })
  items!: ReservationResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}

export class CreateReservationDto {
  @ApiPropertyOptional({
    description: '매장 인증이 없는 내부 호출 호환용입니다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  customerName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  phoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

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

  @ApiProperty()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  bagCount!: number;

  @ApiPropertyOptional({ name: 'price' })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  luggageImageUrls?: string[];

  @ApiPropertyOptional({ default: 'card' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalDateString)
  @IsDateString()
  requestTime?: string;

  @ApiProperty({ enum: reservations_requested_storage_type })
  @IsEnum(reservations_requested_storage_type)
  storageType!: reservations_requested_storage_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerId?: string;
}

export class CreateCustomerReservationDto extends CreateReservationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  declare storeId: string;
}

export class ListStoreReservationsQueryDto {
  @ApiPropertyOptional({
    description:
      '기존 앱 호환용입니다. 인증 토큰의 storeId를 사용하므로 값은 무시됩니다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeId?: string;

  @ApiPropertyOptional({ enum: reservations_status })
  @IsOptional()
  @IsEnum(reservations_status)
  status?: reservations_status;

  @ApiPropertyOptional({ example: '2026-04-27' })
  @IsOptional()
  @Transform(optionalDateString)
  @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListCustomerReservationsQueryDto {
  @ApiPropertyOptional({ enum: reservations_status })
  @IsOptional()
  @IsEnum(reservations_status)
  status?: reservations_status;

  @ApiPropertyOptional({ example: '2026-04-27' })
  @IsOptional()
  @Transform(optionalDateString)
  @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class UpdateReservationStatusDto {
  @ApiProperty({
    description:
      '예약 상태입니다. 기존 Express 호환을 위해 approved, active도 허용합니다.',
    example: 'confirmed',
  })
  @IsString()
  @MaxLength(30)
  status!: string;
}

export class StoreCheckinDto {
  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  photoUrls?: string[] = [];
}

export class ReservationStatusResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: reservations_status })
  status!: reservations_status;

  @ApiPropertyOptional()
  storageId?: string | null;

  @ApiPropertyOptional()
  storageNumber?: string | null;

  @ApiPropertyOptional({ type: [String] })
  photos?: string[];
}
