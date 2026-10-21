import { ApiProperty } from '@nestjs/swagger';
import { store_push_devices_platform } from '@prisma/client';
import { IsEnum, IsString, Length } from 'class-validator';

export class RegisterPushDeviceDto {
  @ApiProperty({ description: 'FCM 등록 토큰' })
  @IsString()
  @Length(1, 500)
  pushToken: string;

  @ApiProperty({ enum: store_push_devices_platform })
  @IsEnum(store_push_devices_platform)
  platform: store_push_devices_platform;
}

export class UnregisterPushDeviceDto {
  @ApiProperty({ description: 'FCM 등록 토큰' })
  @IsString()
  @Length(1, 500)
  pushToken: string;
}
