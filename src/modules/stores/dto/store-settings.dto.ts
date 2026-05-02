import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const LEGACY_TIME_PATTERN = /^(\d|[01]\d|2[0-3]):([0-5]?\d)$/;
const TIME_WITH_SECONDS_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/;

const normalizeTimeValue = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }

  if (TIME_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const legacyTime = LEGACY_TIME_PATTERN.exec(trimmed);
  if (legacyTime) {
    return `${legacyTime[1].padStart(2, '0')}:${legacyTime[2].padStart(2, '0')}`;
  }

  if (TIME_WITH_SECONDS_PATTERN.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(11, 16);
  }

  return trimmed;
};

export class StoreBasicInfoDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ require_protocol: true }, { each: true })
  storePhotos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export class StoreDayHoursDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Transform(normalizeTimeValue)
  @Matches(TIME_PATTERN, { message: 'openTime은 HH:mm 형식이어야 합니다.' })
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Transform(normalizeTimeValue)
  @Matches(TIME_PATTERN, { message: 'closeTime은 HH:mm 형식이어야 합니다.' })
  closeTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOperating?: boolean;
}

export class StoreDailyHoursDto {
  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  월?: StoreDayHoursDto;

  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  화?: StoreDayHoursDto;

  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  수?: StoreDayHoursDto;

  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  목?: StoreDayHoursDto;

  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  금?: StoreDayHoursDto;

  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  토?: StoreDayHoursDto;

  @ApiPropertyOptional({ type: StoreDayHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDayHoursDto)
  일?: StoreDayHoursDto;
}

export class StoreOperatingDaysDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  월?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  화?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  수?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  목?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  금?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  토?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  일?: boolean;
}

export class StoreOperationSettingsDto {
  @ApiPropertyOptional({ type: StoreOperatingDaysDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreOperatingDaysDto)
  operatingDays?: StoreOperatingDaysDto;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Transform(normalizeTimeValue)
  @Matches(TIME_PATTERN, { message: 'openTime은 HH:mm 형식이어야 합니다.' })
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Transform(normalizeTimeValue)
  @Matches(TIME_PATTERN, { message: 'closeTime은 HH:mm 형식이어야 합니다.' })
  closeTime?: string;

  @ApiPropertyOptional({ type: StoreDailyHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreDailyHoursDto)
  dailyHours?: StoreDailyHoursDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  totalSlots?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  dailyRateThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoOverdueNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  holidayNotice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  holidayStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  holidayEndDate?: string;
}

export class StoreStorageSizeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  dailyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  hourUnit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxCapacity?: number;
}

export class StoreStorageSettingsDto {
  @ApiPropertyOptional({ type: StoreStorageSizeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreStorageSizeDto)
  extraSmall?: StoreStorageSizeDto;

  @ApiPropertyOptional({ type: StoreStorageSizeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreStorageSizeDto)
  small?: StoreStorageSizeDto;

  @ApiPropertyOptional({ type: StoreStorageSizeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreStorageSizeDto)
  medium?: StoreStorageSizeDto;

  @ApiPropertyOptional({ type: StoreStorageSizeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreStorageSizeDto)
  large?: StoreStorageSizeDto;

  @ApiPropertyOptional({ type: StoreStorageSizeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreStorageSizeDto)
  special?: StoreStorageSizeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExtraSmallEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSmallEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMediumEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLargeEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSpecialEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  refrigerationAvailable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  refrigerationHourlyFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  refrigerationDailyFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  refrigerationHourUnit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  refrigerationMaxCapacity?: number;
}

export class StoreNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newReservationNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  checkoutReminderNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overdueNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  systemNotification?: boolean;
}

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({ type: StoreBasicInfoDto })
  @IsOptional()
  @IsObject()
  basicInfo?: StoreBasicInfoDto;

  @ApiPropertyOptional({ type: StoreOperationSettingsDto })
  @IsOptional()
  @IsObject()
  operationSettings?: StoreOperationSettingsDto;

  @ApiPropertyOptional({ type: StoreStorageSettingsDto })
  @IsOptional()
  @IsObject()
  storageSettings?: StoreStorageSettingsDto;

  @ApiPropertyOptional({ type: StoreNotificationSettingsDto })
  @IsOptional()
  @IsObject()
  notificationSettings?: StoreNotificationSettingsDto;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  categories?: unknown[];
}

export class StoreSettingsResponseDto {
  @ApiProperty()
  storeId!: string;

  @ApiProperty({ type: StoreBasicInfoDto })
  basicInfo!: StoreBasicInfoDto;

  @ApiPropertyOptional({ type: StoreOperationSettingsDto })
  operationSettings!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: StoreStorageSettingsDto })
  storageSettings!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: StoreNotificationSettingsDto })
  notificationSettings!: Record<string, unknown> | null;

  @ApiProperty({ type: [Object] })
  categories!: unknown[];
}
