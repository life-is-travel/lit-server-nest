import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import {
  FROZEN_STORAGE_PRICES,
  isStorageTypeEnabled,
} from '../../reservations/pricing/reservation-pricing.constants';
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
    reservationWaitPhotos: toStringArray(settings?.reservation_wait_photos),
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
        is24Hours: hours.is_24_hours ?? false,
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
  categories: toCategoryArray(settings?.categories),
});

/**
 * 판매 규격은 소·중·대 3종뿐이다. 폐기된 초소형·특수·냉장은 앱 하위호환을 위해
 * 필드 자체는 남기되 수용량 0으로 내려, 어떤 클라이언트도 재고가 있는 것으로
 * 오해하지 않게 한다. (랜딩은 `enabled !== false && maxCapacity > 0`으로 옵션을 거른다.)
 *
 * 아래 규격 ↔ 컬럼 매핑은 한 칸 밀린 레거시 오프셋(소형→m_*, 중형→l_*, 대형→xl_*)이며,
 * 판매/배정 경로는 같은 오프셋을 reservations/pricing/reservation-pricing.constants.ts의
 * STORAGE_SETTINGS_COLUMNS로 관리한다. 여기 값을 바꾸려면 그 상수도 함께 고쳐야 한다.
 */
const RETIRED_STORAGE_CAPACITY = 0;

const toStorageSettings = (settings: StoreSettingsRecord) => ({
  extraSmall: {
    hourlyRate: FROZEN_STORAGE_PRICES.s,
    dailyRate: FROZEN_STORAGE_PRICES.s,
    hourUnit: settings.s_hour_unit,
    maxCapacity: RETIRED_STORAGE_CAPACITY,
    description: '초소형',
  },
  small: {
    hourlyRate: FROZEN_STORAGE_PRICES.s,
    dailyRate: FROZEN_STORAGE_PRICES.s,
    hourUnit: settings.m_hour_unit,
    maxCapacity: settings.m_max_capacity,
    description: '소형',
  },
  medium: {
    hourlyRate: FROZEN_STORAGE_PRICES.m,
    dailyRate: FROZEN_STORAGE_PRICES.m,
    hourUnit: settings.l_hour_unit,
    maxCapacity: settings.l_max_capacity,
    description: '중형',
  },
  large: {
    hourlyRate: FROZEN_STORAGE_PRICES.l,
    dailyRate: FROZEN_STORAGE_PRICES.l,
    hourUnit: settings.xl_hour_unit,
    maxCapacity: settings.xl_max_capacity,
    description: '대형',
  },
  special: {
    hourlyRate: FROZEN_STORAGE_PRICES.l,
    dailyRate: FROZEN_STORAGE_PRICES.l,
    hourUnit: settings.special_hour_unit,
    maxCapacity: RETIRED_STORAGE_CAPACITY,
    description: '특수',
  },
  isExtraSmallEnabled: false,
  isSmallEnabled: isStorageTypeEnabled(settings, 's'),
  isMediumEnabled: isStorageTypeEnabled(settings, 'm'),
  isLargeEnabled: isStorageTypeEnabled(settings, 'l'),
  isSpecialEnabled: false,
  refrigerationAvailable: false,
  refrigerationHourlyFee: FROZEN_STORAGE_PRICES.s,
  refrigerationDailyFee: FROZEN_STORAGE_PRICES.s,
  refrigerationHourUnit: settings.refrigeration_hour_unit,
  refrigerationMaxCapacity: RETIRED_STORAGE_CAPACITY,
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

const toCategoryArray = (
  value: Prisma.JsonValue | null | undefined,
): Prisma.JsonArray => {
  const categories: Prisma.JsonObject[] = [];
  collectCategoryObjects(value, categories);
  return categories;
};

const collectCategoryObjects = (
  value: Prisma.JsonValue | null | undefined,
  categories: Prisma.JsonObject[],
): void => {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (Array.isArray(item)) {
      collectCategoryObjects(item, categories);
      continue;
    }

    if (item !== null && typeof item === 'object') {
      categories.push(item);
    }
  }
};
