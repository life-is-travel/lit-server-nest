import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns current service health information', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test'),
    } as unknown as ConfigService;
    const service = new HealthService(configService);

    const result = service.getHealth();

    expect(result.status).toBe('ok');
    expect(result.environment).toBe('test');
    expect(result.uptime).toEqual(expect.any(Number) as number);
  });
});
