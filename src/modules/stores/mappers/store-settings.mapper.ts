import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { StoreSettingsResponseDto } from '../dto/store-settings.dto';

type StoreSettingsRecord = NonNullable<
  Awaited<ReturnType<PrismaService['store_settings']['findUnique']>>
>;

type StoreOperatingHoursRecord = NonNullable<
  Awaited<ReturnType<PrismaService['store_operating_hours']['findUnique']>>
>;

export const toStoreSettingsResponse = ({
  storeId,
  storeDescription,
  hours,
  settings,
}: {
  storeId: string;
  storeDescription?: string | null;
  hours?: StoreOperatingHoursRecord | null;
  settings?: StoreSettingsRecord | null;
}): StoreSettingsResponseDto => ({
  storeId,
  basicInfo: {
    storePhotos: toStringArray(settings?.store_photos),
    description: storeDescription ?? undefined,
  },
  operationSettings: hours
    ? {
        operatingDays: toOperatingDays(hours),
        openTime: timeToString(hours.monday_open) ?? '09:00',
        closeTime: timeToString(hours.monday_close) ?? '22:00',
        dailyHours: toDailyHours(hours),
        totalSlots: settings?.total_slots ?? 20,
        dailyRateThreshold: settings?.daily_rate_threshold ?? 7,
        autoApproval: settings?.auto_approval ?? false,
        autoOverdueNotification: settings?.auto_overdue_notification ?? true,
        holidayNotice: hours.holiday_notice,
        holidayStartDate: dateToString(hours.holiday_start_date),
        holidayEndDate: dateToString(hours.holiday_end_date),
      }
    : null,
  storageSettings: settings ? toStorageSettings(settings) : null,
  notificationSettings: settings
    ? {
        newReservationNotification:
          settings.new_reservation_notification ?? true,
        checkoutReminderNotification:
          settings.checkout_reminder_notification ?? true,
        overdueNotification: settings.overdue_notification ?? true,
        systemNotification: settings.system_notification ?? true,
      }
    : null,
  categories: toJsonArray(settings?.categories),
});

const toStorageSettings = (settings: StoreSettingsRecord) => ({
  extraSmall: {
    hourlyRate: settings.s_hourly_rate,
    dailyRate: settings.s_daily_rate,
    hourUnit: settings.s_hour_unit,
    maxCapacity: settings.s_max_capacity,
  },
  small: {
    hourlyRate: settings.m_hourly_rate,
    dailyRate: settings.m_daily_rate,
    hourUnit: settings.m_hour_unit,
    maxCapacity: settings.m_max_capacity,
  },
  medium: {
    hourlyRate: settings.l_hourly_rate,
    dailyRate: settings.l_daily_rate,
    hourUnit: settings.l_hour_unit,
    maxCapacity: settings.l_max_capacity,
  },
  large: {
    hourlyRate: settings.xl_hourly_rate,
    dailyRate: settings.xl_daily_rate,
    hourUnit: settings.xl_hour_unit,
    maxCapacity: settings.xl_max_capacity,
  },
  special: {
    hourlyRate: settings.special_hourly_rate,
    dailyRate: settings.special_daily_rate,
    hourUnit: settings.special_hour_unit,
    maxCapacity: settings.special_max_capacity,
  },
  isExtraSmallEnabled: settings.s_enabled ?? true,
  isSmallEnabled: settings.m_enabled ?? true,
  isMediumEnabled: settings.l_enabled ?? true,
  isLargeEnabled: settings.xl_enabled ?? true,
  isSpecialEnabled: settings.special_enabled ?? true,
  refrigerationAvailable: settings.refrigeration_enabled ?? false,
  refrigerationHourlyFee: settings.refrigeration_hourly_rate,
  refrigerationDailyFee: settings.refrigeration_daily_rate,
  refrigerationHourUnit: settings.refrigeration_hour_unit,
  refrigerationMaxCapacity: settings.refrigeration_max_capacity,
});

const toOperatingDays = (hours: StoreOperatingHoursRecord) => ({
  월: hours.monday_operating ?? true,
  화: hours.tuesday_operating ?? true,
  수: hours.wednesday_operating ?? true,
  목: hours.thursday_operating ?? true,
  금: hours.friday_operating ?? true,
  토: hours.saturday_operating ?? true,
  일: hours.sunday_operating ?? false,
});

const toDailyHours = (hours: StoreOperatingHoursRecord) => ({
  월: toDayHours(hours.monday_open, hours.monday_close, hours.monday_operating),
  화: toDayHours(
    hours.tuesday_open,
    hours.tuesday_close,
    hours.tuesday_operating,
  ),
  수: toDayHours(
    hours.wednesday_open,
    hours.wednesday_close,
    hours.wednesday_operating,
  ),
  목: toDayHours(
    hours.thursday_open,
    hours.thursday_close,
    hours.thursday_operating,
  ),
  금: toDayHours(hours.friday_open, hours.friday_close, hours.friday_operating),
  토: toDayHours(
    hours.saturday_open,
    hours.saturday_close,
    hours.saturday_operating,
  ),
  일: toDayHours(hours.sunday_open, hours.sunday_close, hours.sunday_operating),
});

const toDayHours = (
  openTime: Date | null,
  closeTime: Date | null,
  isOperating: boolean | null,
) => ({
  openTime: timeToString(openTime),
  closeTime: timeToString(closeTime),
  isOperating: isOperating ?? false,
});

const timeToString = (time: Date | null | undefined): string | null => {
  if (!time) {
    return null;
  }

  return time.toISOString().slice(11, 16);
};

const dateToString = (date: Date | null | undefined): string | null => {
  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const toStringArray = (
  value: Prisma.JsonValue | null | undefined,
): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const toJsonArray = (
  value: Prisma.JsonValue | null | undefined,
): Prisma.JsonArray => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
};
