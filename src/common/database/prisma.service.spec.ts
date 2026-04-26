import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects and disconnects through Prisma lifecycle hooks', async () => {
    const configService = {
      getOrThrow: jest
        .fn()
        .mockReturnValue('mysql://root:password@localhost:3306/lit_test'),
    } as unknown as ConfigService;
    const service = new PrismaService(configService);
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
