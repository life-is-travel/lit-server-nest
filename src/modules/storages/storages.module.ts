import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoragePolicyService } from './services/storage-policy.service';
import { StoragesCommandService } from './services/storages-command.service';
import { StoragesQueryService } from './services/storages-query.service';
import { StoragesController } from './storages.controller';

@Module({
  imports: [AuthModule],
  controllers: [StoragesController],
  providers: [
    StoragesQueryService,
    StoragesCommandService,
    StoragePolicyService,
  ],
})
export class StoragesModule {}
