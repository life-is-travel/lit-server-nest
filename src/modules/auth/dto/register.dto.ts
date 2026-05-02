import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { stores_business_type } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  optionalBoolean,
  optionalNumber,
} from '../../../common/transformers/legacy-input.transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'store@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '루라운지 혼술바' })
  @IsString()
  @MinLength(1)
  businessName: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '050700000000' })
  @IsOptional()
  @IsString()
  storePhoneNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  wantsSmsNotification?: boolean;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  businessNumber?: string;

  @ApiPropertyOptional({ example: '홍길동' })
  @IsOptional()
  @IsString()
  representativeName?: string;

  @ApiPropertyOptional({ example: '서울 용산구 한강대로44길 5' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '지하 1층' })
  @IsOptional()
  @IsString()
  detailAddress?: string;

  @ApiPropertyOptional({ example: 37.529 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 126.968 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ enum: stores_business_type, example: 'RESTAURANT' })
  @IsOptional()
  @IsEnum(stores_business_type)
  businessType?: stores_business_type;

  @ApiPropertyOptional({ example: '매장 소개' })
  @IsOptional()
  @IsString()
  description?: string;
}
