import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FcmSenderService } from './fcm-sender.service';
import { StorePushDevicesController } from './store-push-devices.controller';
import { StorePushService } from './store-push.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StorePushDevicesController],
  providers: [FcmSenderService, StorePushService],
  exports: [StorePushService],
})
export class PushModule {}
