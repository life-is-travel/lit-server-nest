import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      uptime: Number(process.uptime().toFixed(3)),
      environment: this.configService.getOrThrow<string>('NODE_ENV'),
    };
  }
}
