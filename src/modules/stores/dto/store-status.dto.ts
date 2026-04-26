import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { store_status_status } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStoreStatusDto {
  @ApiProperty({
    enum: store_status_status,
    description: '매장 영업 상태',
    example: store_status_status.open,
  })
  @IsEnum(store_status_status)
  status!: store_status_status;

  @ApiPropertyOptional({
    description: '상태 변경 사유',
    example: '임시 휴무',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
