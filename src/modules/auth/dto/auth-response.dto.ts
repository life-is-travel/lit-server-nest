import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StoreUserInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  storeId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  businessName: string;

  @ApiPropertyOptional({ nullable: true })
  phoneNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  storePhoneNumber: string | null;

  @ApiProperty()
  wantsSmsNotification: boolean;

  @ApiPropertyOptional({ nullable: true })
  businessType: string | null;

  @ApiProperty()
  hasCompletedSetup: boolean;

  @ApiPropertyOptional({ nullable: true })
  businessNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  representativeName: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  detailAddress: string | null;

  @ApiPropertyOptional({ nullable: true })
  latitude: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude: number | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  updatedAt: Date | null;
}

export class AuthTokenResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 3600 })
  expiresIn: number;

  @ApiProperty({ type: StoreUserInfoDto })
  user_info: StoreUserInfoDto;
}

export class RefreshAccessTokenResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty({ example: 3600 })
  expiresIn: number;
}
