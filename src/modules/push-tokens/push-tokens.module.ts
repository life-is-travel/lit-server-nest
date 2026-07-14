import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';

@Module({
  imports: [AuthModule],
  controllers: [PushTokensController],
  providers: [PushTokensService],
})
export class PushTokensModule {}
