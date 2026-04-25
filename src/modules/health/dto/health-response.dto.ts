import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 12.345 })
  uptime: number;

  @ApiProperty({ example: 'development' })
  environment: string;
}

export class HealthSuccessResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: HealthResponseDto })
  data: HealthResponseDto;

  @ApiProperty({ example: '2026-04-26T10:00:00.000Z' })
  timestamp: string;
}
