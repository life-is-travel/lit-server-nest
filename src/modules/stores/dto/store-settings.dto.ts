import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
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

const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null ? undefined : value;

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
  @Transform(emptyToUndefined)
  @Matches(TIME_PATTERN, { message: 'openTime은 HH:mm 형식이어야 합니다.' })
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Transform(emptyToUndefined)
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
  @Transform(emptyToUndefined)
  @Matches(TIME_PATTERN, { message: 'openTime은 HH:mm 형식이어야 합니다.' })
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Transform(emptyToUndefined)
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
  @ValidateNested()
  @Type(() => StoreBasicInfoDto)
  basicInfo?: StoreBasicInfoDto;

  @ApiPropertyOptional({ type: StoreOperationSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreOperationSettingsDto)
  operationSettings?: StoreOperationSettingsDto;

  @ApiPropertyOptional({ type: StoreStorageSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreStorageSettingsDto)
  storageSettings?: StoreStorageSettingsDto;

  @ApiPropertyOptional({ type: StoreNotificationSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreNotificationSettingsDto)
  notificationSettings?: StoreNotificationSettingsDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  categories?: string[];
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

  @ApiProperty({ type: [String] })
  categories!: string[];
}
