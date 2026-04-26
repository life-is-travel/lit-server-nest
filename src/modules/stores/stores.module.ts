import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorePinService } from './services/store-pin.service';
import { StoreSettingsService } from './services/store-settings.service';
import { StoreStatusService } from './services/store-status.service';
import { StoreStorageSyncService } from './services/store-storage-sync.service';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule],
  controllers: [StoresController],
  providers: [
    StoresService,
    StoreStatusService,
    StoreSettingsService,
    StoreStorageSyncService,
    StorePinService,
  ],
})
export class StoresModule {}
