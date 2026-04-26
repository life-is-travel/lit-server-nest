import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class StorePinDto {
  @ApiProperty({
    description: '4자리 숫자 PIN',
    example: '1234',
  })
  @IsString()
  @Matches(/^[0-9]{4}$/, {
    message: 'PIN은 4자리 숫자여야 합니다.',
  })
  pin!: string;
}

export class SetStorePinResponseDto {
  @ApiProperty()
  storeId!: string;

  @ApiProperty()
  pinSet!: true;

  @ApiPropertyOptional()
  pinUpdatedAt?: Date | null;
}

export class CheckStorePinResponseDto {
  @ApiProperty()
  storeId!: string;

  @ApiProperty()
  matched!: true;
}
