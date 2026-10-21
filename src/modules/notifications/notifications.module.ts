import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, PushModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
