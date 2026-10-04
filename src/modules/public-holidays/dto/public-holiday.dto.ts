import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ListPublicHolidaysQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: '조회 시작일(YYYY-MM-DD). 기본값은 오늘(KST)',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: '조회 종료일(YYYY-MM-DD). 기본값은 시작일로부터 400일 뒤',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

export class PublicHolidayResponseDto {
  @ApiProperty({ example: '2026-10-05' })
  date!: string;

  @ApiProperty({ example: '대체공휴일(개천절)' })
  name!: string;
}
