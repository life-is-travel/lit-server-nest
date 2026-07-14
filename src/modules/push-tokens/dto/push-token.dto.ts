import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export type PushTokenPlatform = 'ios' | 'android';

export class RegisterPushTokenDto {
  @ApiProperty({ description: 'FCM 등록 토큰', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;

  @ApiProperty({ enum: ['ios', 'android'], description: '기기 플랫폼' })
  @IsIn(['ios', 'android'])
  platform!: PushTokenPlatform;
}

export class DeletePushTokenDto {
  @ApiProperty({ description: '삭제할 FCM 등록 토큰', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;
}
