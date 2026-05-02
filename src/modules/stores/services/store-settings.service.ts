import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import {
  StoreDayHoursDto,
  StoreOperationSettingsDto,
  StoreSettingsResponseDto,
  StoreStorageSettingsDto,
  StoreStorageSizeDto,
  UpdateStoreSettingsDto,
} from '../dto/store-settings.dto';
import { toStoreSettingsResponse } from '../mappers/store-settings.mapper';
import { StoreStorageSyncService } from './store-storage-sync.service';

type StoreSettingsRecord = Awaited<
  ReturnType<PrismaService['store_settings']['findUnique']>
>;

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageSyncService: StoreStorageSyncService,
  ) {}

  async getSettings(storeId: string): Promise<StoreSettingsResponseDto> {
    await this.assertStoreExists(storeId);

    const [store, hours, settings] = await Promise.all([
      this.prisma.stores.findUnique({
        where: { id: storeId },
        select: { description: true },
      }),
      this.prisma.store_operating_hours.findUnique({
        where: { store_id: storeId },
      }),
      this.prisma.store_settings.findUnique({
        where: { store_id: storeId },
      }),
    ]);

    return toStoreSettingsResponse({
      storeId,
      storeDescription: store?.description,
      hours,
      settings,
    });
  }

  async updateSettings(
    storeId: string,
    dto: UpdateStoreSettingsDto,
  ): Promise<StoreSettingsResponseDto> {
    await this.assertStoreExists(storeId);

    await this.prisma.$transaction(
      async (tx) => {
        const existingSettings = await tx.store_settings.findUnique({
          where: { store_id: storeId },
        });

        const settingsData = this.buildSettingsData(dto, existingSettings);

        await tx.stores.update({
          where: { id: storeId },
          data: {
            has_completed_setup: true,
            ...(dto.basicInfo?.description !== undefined
              ? { description: dto.basicInfo.description.trim() }
              : {}),
            updated_at: new Date(),
          },
        });

        await tx.store_settings.upsert({
          where: { store_id: storeId },
          create: {
            store_id: storeId,
            ...settingsData,
          },
          update: {
            ...settingsData,
            updated_at: new Date(),
          },
        });

        if (dto.operationSettings) {
          await this.upsertOperatingHours(tx, storeId, dto.operationSettings);
        }

        if (dto.storageSettings) {
          await this.storageSyncService.syncFromSettings(
            tx,
            storeId,
            dto.storageSettings,
          );
        }
      },
      { timeout: 15000 },
    );

    return this.getSettings(storeId);
  }

  private buildSettingsData(
    dto: UpdateStoreSettingsDto,
    existingSettings: StoreSettingsRecord,
  ) {
    const storage = dto.storageSettings;
    const operation = dto.operationSettings;
    const refrigeration = (
      storage as (StoreStorageSettingsDto & { refrigeration?: StoreStorageSizeDto }) | undefined
    )?.refrigeration;
    const totalSlots =
      storage !== undefined
        ? this.calculateTotalSlots(storage)
        : this.toNumber(operation?.totalSlots);

    return {
      store_photos:
        dto.basicInfo?.storePhotos !== undefined
          ? dto.basicInfo.storePhotos
          : (existingSettings?.store_photos ?? Prisma.JsonNull),
      total_slots: totalSlots ?? existingSettings?.total_slots ?? 20,
      daily_rate_threshold:
        this.toNumber(operation?.dailyRateThreshold) ??
        existingSettings?.daily_rate_threshold ??
        7,
      auto_approval:
        this.toBoolean(operation?.autoApproval) ??
        existingSettings?.auto_approval ??
        false,
      auto_overdue_notification:
        this.toBoolean(operation?.autoOverdueNotification) ??
        existingSettings?.auto_overdue_notification ??
        true,
      s_hourly_rate:
        this.toNumber(storage?.extraSmall?.hourlyRate) ??
        existingSettings?.s_hourly_rate ??
        2000,
      s_daily_rate:
        this.toNumber(storage?.extraSmall?.dailyRate) ??
        existingSettings?.s_daily_rate ??
        15000,
      s_hour_unit:
        this.toNumber(storage?.extraSmall?.hourUnit) ??
        existingSettings?.s_hour_unit ??
        1,
      s_max_capacity:
        this.toNumber(storage?.extraSmall?.maxCapacity) ??
        existingSettings?.s_max_capacity ??
        5,
      s_enabled:
        this.toBoolean(storage?.isExtraSmallEnabled) ??
        existingSettings?.s_enabled ??
        true,
      m_hourly_rate:
        this.toNumber(storage?.small?.hourlyRate) ??
        existingSettings?.m_hourly_rate ??
        3000,
      m_daily_rate:
        this.toNumber(storage?.small?.dailyRate) ??
        existingSettings?.m_daily_rate ??
        24000,
      m_hour_unit:
        this.toNumber(storage?.small?.hourUnit) ??
        existingSettings?.m_hour_unit ??
        1,
      m_max_capacity:
        this.toNumber(storage?.small?.maxCapacity) ??
        existingSettings?.m_max_capacity ??
        8,
      m_enabled:
        this.toBoolean(storage?.isSmallEnabled) ??
        existingSettings?.m_enabled ??
        true,
      l_hourly_rate:
        this.toNumber(storage?.medium?.hourlyRate) ??
        existingSettings?.l_hourly_rate ??
        5000,
      l_daily_rate:
        this.toNumber(storage?.medium?.dailyRate) ??
        existingSettings?.l_daily_rate ??
        40000,
      l_hour_unit:
        this.toNumber(storage?.medium?.hourUnit) ??
        existingSettings?.l_hour_unit ??
        1,
      l_max_capacity:
        this.toNumber(storage?.medium?.maxCapacity) ??
        existingSettings?.l_max_capacity ??
        3,
      l_enabled:
        this.toBoolean(storage?.isMediumEnabled) ??
        existingSettings?.l_enabled ??
        true,
      xl_hourly_rate:
        this.toNumber(storage?.large?.hourlyRate) ??
        existingSettings?.xl_hourly_rate ??
        7000,
      xl_daily_rate:
        this.toNumber(storage?.large?.dailyRate) ??
        existingSettings?.xl_daily_rate ??
        55000,
      xl_hour_unit:
        this.toNumber(storage?.large?.hourUnit) ??
        existingSettings?.xl_hour_unit ??
        1,
      xl_max_capacity:
        this.toNumber(storage?.large?.maxCapacity) ??
        existingSettings?.xl_max_capacity ??
        2,
      xl_enabled:
        this.toBoolean(storage?.isLargeEnabled) ??
        existingSettings?.xl_enabled ??
        true,
      special_hourly_rate:
        this.toNumber(storage?.special?.hourlyRate) ??
        existingSettings?.special_hourly_rate ??
        10000,
      special_daily_rate:
        this.toNumber(storage?.special?.dailyRate) ??
        existingSettings?.special_daily_rate ??
        70000,
      special_hour_unit:
        this.toNumber(storage?.special?.hourUnit) ??
        existingSettings?.special_hour_unit ??
        1,
      special_max_capacity:
        this.toNumber(storage?.special?.maxCapacity) ??
        existingSettings?.special_max_capacity ??
        1,
      special_enabled:
        this.toBoolean(storage?.isSpecialEnabled) ??
        existingSettings?.special_enabled ??
        true,
      refrigeration_enabled:
        this.toBoolean(storage?.refrigerationAvailable) ??
        existingSettings?.refrigeration_enabled ??
        false,
      refrigeration_hourly_rate:
        this.toNumber(storage?.refrigerationHourlyFee) ??
        this.toNumber(refrigeration?.hourlyRate) ??
        existingSettings?.refrigeration_hourly_rate ??
        3000,
      refrigeration_daily_rate:
        this.toNumber(storage?.refrigerationDailyFee) ??
        this.toNumber(refrigeration?.dailyRate) ??
        existingSettings?.refrigeration_daily_rate ??
        20000,
      refrigeration_hour_unit:
        this.toNumber(storage?.refrigerationHourUnit) ??
        this.toNumber(refrigeration?.hourUnit) ??
        existingSettings?.refrigeration_hour_unit ??
        1,
      refrigeration_max_capacity:
        this.toNumber(storage?.refrigerationMaxCapacity) ??
        this.toNumber(refrigeration?.maxCapacity) ??
        existingSettings?.refrigeration_max_capacity ??
        3,
      new_reservation_notification:
        this.toBoolean(dto.notificationSettings?.newReservationNotification) ??
        existingSettings?.new_reservation_notification ??
        true,
      checkout_reminder_notification:
        this.toBoolean(
          dto.notificationSettings?.checkoutReminderNotification,
        ) ??
        existingSettings?.checkout_reminder_notification ??
        true,
      overdue_notification:
        this.toBoolean(dto.notificationSettings?.overdueNotification) ??
        existingSettings?.overdue_notification ??
        true,
      system_notification:
        this.toBoolean(dto.notificationSettings?.systemNotification) ??
        existingSettings?.system_notification ??
        true,
      categories:
        dto.categories !== undefined
          ? (dto.categories as Prisma.InputJsonArray)
          : (existingSettings?.categories ?? Prisma.JsonNull),
    };
  }

  private async upsertOperatingHours(
    tx: Prisma.TransactionClient,
    storeId: string,
    operation: StoreOperationSettingsDto,
  ): Promise<void> {
    const existing = await tx.store_operating_hours.findUnique({
      where: { store_id: storeId },
    });
    const dailyHours = operation.dailyHours ?? {};
    const now = new Date();

    const data = {
      monday_open: this.resolveTime(dailyHours.월, existing?.monday_open),
      monday_close: this.resolveCloseTime(
        dailyHours.월,
        existing?.monday_close,
      ),
      monday_operating:
        this.toBoolean(dailyHours.월?.isOperating) ??
        existing?.monday_operating ??
        true,
      tuesday_open: this.resolveTime(dailyHours.화, existing?.tuesday_open),
      tuesday_close: this.resolveCloseTime(
        dailyHours.화,
        existing?.tuesday_close,
      ),
      tuesday_operating:
        this.toBoolean(dailyHours.화?.isOperating) ??
        existing?.tuesday_operating ??
        true,
      wednesday_open: this.resolveTime(dailyHours.수, existing?.wednesday_open),
      wednesday_close: this.resolveCloseTime(
        dailyHours.수,
        existing?.wednesday_close,
      ),
      wednesday_operating:
        this.toBoolean(dailyHours.수?.isOperating) ??
        existing?.wednesday_operating ??
        true,
      thursday_open: this.resolveTime(dailyHours.목, existing?.thursday_open),
      thursday_close: this.resolveCloseTime(
        dailyHours.목,
        existing?.thursday_close,
      ),
      thursday_operating:
        this.toBoolean(dailyHours.목?.isOperating) ??
        existing?.thursday_operating ??
        true,
      friday_open: this.resolveTime(dailyHours.금, existing?.friday_open),
      friday_close: this.resolveCloseTime(
        dailyHours.금,
        existing?.friday_close,
      ),
      friday_operating:
        this.toBoolean(dailyHours.금?.isOperating) ??
        existing?.friday_operating ??
        true,
      saturday_open: this.resolveTime(dailyHours.토, existing?.saturday_open),
      saturday_close: this.resolveCloseTime(
        dailyHours.토,
        existing?.saturday_close,
      ),
      saturday_operating:
        this.toBoolean(dailyHours.토?.isOperating) ??
        existing?.saturday_operating ??
        true,
      sunday_open: this.resolveTime(dailyHours.일, existing?.sunday_open),
      sunday_close: this.resolveCloseTime(
        dailyHours.일,
        existing?.sunday_close,
      ),
      sunday_operating:
        this.toBoolean(dailyHours.일?.isOperating) ??
        existing?.sunday_operating ??
        false,
      holiday_notice:
        operation.holidayNotice?.trim() ?? existing?.holiday_notice ?? null,
      holiday_start_date:
        operation.holidayStartDate !== undefined
          ? this.toDateOrNull(operation.holidayStartDate)
          : (existing?.holiday_start_date ?? null),
      holiday_end_date:
        operation.holidayEndDate !== undefined
          ? this.toDateOrNull(operation.holidayEndDate)
          : (existing?.holiday_end_date ?? null),
      updated_at: now,
    };

    await tx.store_operating_hours.upsert({
      where: { store_id: storeId },
      create: {
        store_id: storeId,
        ...data,
        created_at: now,
      },
      update: data,
    });
  }

  private calculateTotalSlots(storage: StoreStorageSettingsDto): number {
    const refrigeration = (
      storage as StoreStorageSettingsDto & { refrigeration?: StoreStorageSizeDto }
    ).refrigeration;

    return (
      (this.toBoolean(storage.isExtraSmallEnabled)
        ? (this.toNumber(storage.extraSmall?.maxCapacity) ?? 0)
        : 0) +
      (this.toBoolean(storage.isSmallEnabled)
        ? (this.toNumber(storage.small?.maxCapacity) ?? 0)
        : 0) +
      (this.toBoolean(storage.isMediumEnabled)
        ? (this.toNumber(storage.medium?.maxCapacity) ?? 0)
        : 0) +
      (this.toBoolean(storage.isLargeEnabled)
        ? (this.toNumber(storage.large?.maxCapacity) ?? 0)
        : 0) +
      (this.toBoolean(storage.isSpecialEnabled)
        ? (this.toNumber(storage.special?.maxCapacity) ?? 0)
        : 0) +
      (this.toBoolean(storage.refrigerationAvailable)
        ? (this.toNumber(storage.refrigerationMaxCapacity) ??
          this.toNumber(refrigeration?.maxCapacity) ??
          0)
        : 0)
    );
  }

  private resolveTime(
    day: StoreDayHoursDto | undefined,
    fallback: Date | null | undefined,
  ): Date | null {
    if (day?.openTime !== undefined) {
      return this.timeFromString(day.openTime);
    }

    return fallback ?? null;
  }

  private resolveCloseTime(
    day: StoreDayHoursDto | undefined,
    fallback: Date | null | undefined,
  ): Date | null {
    if (day?.closeTime !== undefined) {
      return this.timeFromString(day.closeTime);
    }

    return fallback ?? null;
  }

  private timeFromString(time: unknown): Date | null {
    const normalized = this.toTimeString(time);
    return normalized ? new Date(`1970-01-01T${normalized}:00.000Z`) : null;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isNaN(value) ? undefined : value;
    }

    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? undefined : numericValue;
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

  private toDateOrNull(value: unknown): Date | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toTimeString(value: unknown): string | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(11, 16);
    }

    const trimmed = String(value).trim();
    const strictTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    const legacyTime = /^(\d|[01]\d|2[0-3]):([0-5]?\d)$/;
    const timeWithSeconds =
      /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/;

    if (strictTime.test(trimmed)) {
      return trimmed;
    }

    const legacyMatch = legacyTime.exec(trimmed);
    if (legacyMatch) {
      return `${legacyMatch[1].padStart(2, '0')}:${legacyMatch[2].padStart(2, '0')}`;
    }

    if (timeWithSeconds.test(trimmed)) {
      return trimmed.slice(0, 5);
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(11, 16);
    }

    return null;
  }

  private async assertStoreExists(storeId: string): Promise<void> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }
  }
}
