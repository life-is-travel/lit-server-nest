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
    const refrigeration = (
      storageSettings as StoreStorageSettingsDto & {
        refrigeration?: StoreStorageSizeDto;
      }
    ).refrigeration;

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
        enabled: this.toBoolean(storageSettings.refrigerationAvailable) ?? false,
        capacity:
          this.toNumber(storageSettings.refrigerationMaxCapacity) ??
          this.toNumber(refrigeration?.maxCapacity) ??
          0,
        hourlyRate:
          this.toNumber(storageSettings.refrigerationHourlyFee) ??
          this.toNumber(refrigeration?.hourlyRate) ??
          0,
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
      enabled: this.toBoolean(enabled) ?? false,
      capacity: this.toNumber(size?.maxCapacity) ?? 0,
      hourlyRate: this.toNumber(size?.hourlyRate) ?? 0,
    };
  }

  private toNumber(value: unknown): number | undefined {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? undefined : numberValue;
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }

    return undefined;
  }

  private storageNumber(prefix: string, index: number): string {
    return `${prefix}${index}`;
  }
}
