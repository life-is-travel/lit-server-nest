import { Injectable } from '@nestjs/common';
import { Prisma, storages_status, storages_type } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  StoreStorageSettingsDto,
  StoreStorageSizeDto,
} from '../dto/store-settings.dto';

type StorageConfig = {
  type: storages_type;
  prefix: string;
  enabled: boolean;
  capacity: number;
  hourlyRate: number;
};

@Injectable()
export class StoreStorageSyncService {
  async syncFromSettings(
    tx: Prisma.TransactionClient,
    storeId: string,
    storageSettings: StoreStorageSettingsDto,
  ): Promise<void> {
    const configs = this.buildStorageConfigs(storageSettings);

    for (const config of configs) {
      const existing = await tx.storages.findMany({
        where: { store_id: storeId, type: config.type },
        orderBy: { number: 'asc' },
      });

      const existingNumbers = new Set(
        existing.map((storage) => storage.number),
      );
      const targetNumbers = new Set(
        Array.from({ length: config.capacity }, (_, index) =>
          this.storageNumber(config.prefix, index + 1),
        ),
      );

      if (config.enabled && config.capacity > 0) {
        for (let index = 1; index <= config.capacity; index += 1) {
          const number = this.storageNumber(config.prefix, index);

          if (!existingNumbers.has(number)) {
            await tx.storages.create({
              data: {
                id: `stor_${randomUUID()}`,
                store_id: storeId,
                number,
                type: config.type,
                status: storages_status.available,
                pricing: config.hourlyRate,
              },
            });
          }
        }

        await tx.storages.updateMany({
          where: {
            store_id: storeId,
            type: config.type,
            number: { in: [...targetNumbers] },
          },
          data: {
            pricing: config.hourlyRate,
            updated_at: new Date(),
          },
        });
      }

      const excessAvailableIds = existing
        .filter(
          (storage) =>
            (!config.enabled || !targetNumbers.has(storage.number)) &&
            storage.status === storages_status.available,
        )
        .map((storage) => storage.id);

      if (excessAvailableIds.length > 0) {
        await tx.storages.updateMany({
          where: { id: { in: excessAvailableIds } },
          data: {
            status: storages_status.maintenance,
            updated_at: new Date(),
          },
        });
      }
    }
  }

  private buildStorageConfigs(
    storageSettings: StoreStorageSettingsDto,
  ): StorageConfig[] {
    return [
      this.buildStorageConfig(
        storages_type.s,
        'S',
        storageSettings.isExtraSmallEnabled,
        storageSettings.extraSmall,
      ),
      this.buildStorageConfig(
        storages_type.m,
        'M',
        storageSettings.isSmallEnabled,
        storageSettings.small,
      ),
      this.buildStorageConfig(
        storages_type.l,
        'L',
        storageSettings.isMediumEnabled,
        storageSettings.medium,
      ),
      this.buildStorageConfig(
        storages_type.xl,
        'XL',
        storageSettings.isLargeEnabled,
        storageSettings.large,
      ),
      this.buildStorageConfig(
        storages_type.special,
        'SP',
        storageSettings.isSpecialEnabled,
        storageSettings.special,
      ),
      {
        type: storages_type.refrigeration,
        prefix: 'RF',
        enabled: storageSettings.refrigerationAvailable ?? false,
        capacity: storageSettings.refrigerationMaxCapacity ?? 0,
        hourlyRate: storageSettings.refrigerationHourlyFee ?? 0,
      },
    ];
  }

  private buildStorageConfig(
    type: storages_type,
    prefix: string,
    enabled: boolean | undefined,
    size: StoreStorageSizeDto | undefined,
  ): StorageConfig {
    return {
      type,
      prefix,
      enabled: enabled ?? false,
      capacity: size?.maxCapacity ?? 0,
      hourlyRate: size?.hourlyRate ?? 0,
    };
  }

  private storageNumber(prefix: string, index: number): string {
    return `${prefix}${index}`;
  }
}
