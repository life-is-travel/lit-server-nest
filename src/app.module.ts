import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/database/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { createLoggerParams } from './config/logger.config';
import { R2StorageModule } from './common/storage/r2-storage.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerAuthModule } from './modules/customer-auth/customer-auth.module';
import { CustomerStoresModule } from './modules/customer-stores/customer-stores.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { HealthModule } from './modules/health/health.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { StoragesModule } from './modules/storages/storages.module';
import { StoresModule } from './modules/stores/stores.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createLoggerParams,
    }),
    PrismaModule,
    R2StorageModule,
    AddressesModule,
    AuthModule,
    CustomerAuthModule,
    CustomerStoresModule,
    CouponsModule,
    HealthModule,
    StoresModule,
    StoragesModule,
    ReservationsModule,
    DashboardModule,
    FeedbacksModule,
    UploadsModule,
  ],
})
export class AppModule {}
