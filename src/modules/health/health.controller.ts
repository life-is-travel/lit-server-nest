import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthResponseDto,
  HealthSuccessResponseDto,
} from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '서버 상태를 확인합니다.' })
  @ApiOkResponse({ type: HealthSuccessResponseDto })
  getHealth(): HealthResponseDto {
    return this.healthService.getHealth();
  }
}
