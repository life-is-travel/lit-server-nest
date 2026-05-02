import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { stores_business_type } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  emptyToUndefined,
  optionalBoolean,
  optionalNumber,
} from '../../../common/transformers/legacy-input.transformer';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class StoreProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  businessName!: string;

  @ApiPropertyOptional()
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  storePhoneNumber?: string | null;

  @ApiProperty()
  wantsSmsNotification!: boolean;

  @ApiPropertyOptional()
  businessNumber?: string | null;

  @ApiPropertyOptional()
  representativeName?: string | null;

  @ApiPropertyOptional()
  address?: string | null;

  @ApiPropertyOptional()
  detailAddress?: string | null;

  @ApiPropertyOptional()
  latitude?: number | null;

  @ApiPropertyOptional()
  longitude?: number | null;

  @ApiPropertyOptional({ enum: stores_business_type })
  businessType?: stores_business_type | null;

  @ApiPropertyOptional()
  profileImageUrl?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  hasCompletedSetup!: boolean;

  @ApiPropertyOptional()
  createdAt?: Date | null;

  @ApiPropertyOptional()
  updatedAt?: Date | null;
}

export class UpdateStoreProfileDto {
  @ApiPropertyOptional({
    description: '매장명입니다. businessName과 동일하게 처리합니다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: '매장명' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  storePhoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  wantsSmsNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  representativeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detailAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: stores_business_type })
  @IsOptional()
  @IsEnum(stores_business_type)
  businessType?: stores_business_type;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasCompletedSetup?: boolean;
}
