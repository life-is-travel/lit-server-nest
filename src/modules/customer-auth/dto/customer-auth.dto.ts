import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { customers_gender, customers_provider_type } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  emptyToUndefined,
  optionalBoolean,
  optionalDateString,
} from '../../../common/transformers/legacy-input.transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CustomerSocialLoginDto {
  @ApiProperty({ enum: customers_provider_type, example: 'kakao' })
  @IsEnum(customers_provider_type)
  provider!: customers_provider_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  accessToken?: string;

  @ApiPropertyOptional({ description: '기존 Express 호환 필드입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  socialAccessToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refreshToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  socialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalDateString)
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  carrier?: string;

  @ApiPropertyOptional({ enum: customers_gender })
  @IsOptional()
  @IsEnum(customers_gender)
  gender?: customers_gender;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  termsAgreed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  privacyAgreed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  locationAgreed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  marketingAgreed?: boolean;
}

export class CustomerSignupDto {
  @ApiPropertyOptional({ enum: customers_provider_type })
  @IsOptional()
  @IsEnum(customers_provider_type)
  provider?: customers_provider_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  accessToken?: string;

  @ApiPropertyOptional({ description: '기존 Express 호환 필드입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  socialAccessToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refreshToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  socialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalDateString)
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  carrier?: string;

  @ApiPropertyOptional({ enum: customers_gender })
  @IsOptional()
  @IsEnum(customers_gender)
  gender?: customers_gender;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  termsAgreed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  privacyAgreed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  locationAgreed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  marketingAgreed?: boolean;
}

export class CustomerRefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  refreshToken!: string;
}

export class CustomerLogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refreshToken?: string;
}

export class UpdateCustomerMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  profileImage?: string;
}

export class UpdateCustomerNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  marketingEnabled?: boolean;
}

export class CustomerAuthResponseDto {
  @ApiProperty()
  isNewUser!: boolean;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiPropertyOptional()
  providerRefreshToken?: string | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  profileImage?: string | null;

  @ApiPropertyOptional()
  birthDate?: Date | string | null;

  @ApiPropertyOptional()
  carrier?: string | null;

  @ApiPropertyOptional({ enum: customers_gender })
  gender?: customers_gender | null;

  @ApiProperty()
  termsAgreed!: number;

  @ApiProperty()
  privacyAgreed!: number;

  @ApiProperty()
  locationAgreed!: number;

  @ApiProperty()
  marketingAgreed!: number;

  @ApiProperty({ enum: customers_provider_type })
  provider!: customers_provider_type;
}

export class CustomerRefreshTokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}

export class CustomerMessageResponseDto {
  @ApiProperty()
  message!: string;
}

export class CustomerMeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  phoneNumber?: string | null;

  @ApiProperty({ enum: customers_provider_type })
  provider!: customers_provider_type;

  @ApiPropertyOptional()
  profileImage?: string | null;
}

export class CustomerNotificationSettingsResponseDto {
  @ApiProperty()
  pushEnabled!: boolean;

  @ApiProperty()
  emailEnabled!: boolean;

  @ApiProperty()
  smsEnabled!: boolean;

  @ApiProperty()
  marketingEnabled!: boolean;
}
