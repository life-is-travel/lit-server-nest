import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');
  const corsOrigin = configService.getOrThrow<string>('CORS_ORIGIN');

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  await app.listen(port);
}

bootstrap().catch((error) => {
  // 서버 시작 단계의 설정 오류를 배포 로그에서 바로 확인할 수 있게 처리합니다.
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});
