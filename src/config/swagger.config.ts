import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const setupSwagger = (app: INestApplication): void => {
  const configService = app.get(ConfigService);
  const swaggerEnabled = configService.getOrThrow<boolean>('SWAGGER_ENABLED');

  if (!swaggerEnabled) {
    return;
  }

  const swaggerPath = configService.getOrThrow<string>('SWAGGER_PATH');
  const documentConfig = new DocumentBuilder()
    .setTitle('Life Is Travel API')
    .setDescription('Life Is Travel NestJS API documentation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);

  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
};
