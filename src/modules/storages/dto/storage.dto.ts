import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { storages_status, storages_type } from '@prisma/client';
import { Transform } from 'class-transformer';
import { optionalNumber } from '../../../common/transformers/legacy-input.transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StorageSizeDto {
  @ApiPropertyOptional()
  width?: number | null;

  @ApiPropertyOptional()
  height?: number | null;

  @ApiPropertyOptional()
  depth?: number | null;
}

export class StorageLocationDto {
  @ApiPropertyOptional()
  floor?: number | null;

  @ApiPropertyOptional()
  section?: string | null;

  @ApiPropertyOptional()
  row?: number | null;

  @ApiPropertyOptional()
  column?: number | null;
}

export class CurrentReservationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerName!: string;

  @ApiPropertyOptional()
  customerPhone?: string;

  @ApiProperty()
  startTime!: Date;

  @ApiPropertyOptional()
  endTime?: Date | null;

  @ApiPropertyOptional()
  status?: string | null;
}

export class StorageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  storeId!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ enum: storages_type })
  type!: storages_type;

  @ApiProperty({ enum: storages_status })
  status!: storages_status;

  @ApiProperty({ type: StorageSizeDto })
  size!: StorageSizeDto;

  @ApiProperty()
  pricing!: number;

  @ApiProperty({ type: StorageLocationDto })
  location!: StorageLocationDto;

  @ApiPropertyOptional()
  createdAt?: Date | null;

  @ApiPropertyOptional()
  updatedAt?: Date | null;

  @ApiPropertyOptional({ type: CurrentReservationDto })
  currentReservation?: CurrentReservationDto;
}

export class StoragePaginationDto {
  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  itemsPerPage!: number;
}

export class StorageListResponseDto {
  @ApiProperty({ type: [StorageResponseDto] })
  storages!: StorageResponseDto[];

  @ApiProperty({ type: StoragePaginationDto })
  pagination!: StoragePaginationDto;
}

export class UpdateStorageDto {
  @ApiPropertyOptional({ example: 'S1' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;

  @ApiPropertyOptional({ enum: storages_type })
  @IsOptional()
  @IsEnum(storages_type)
  type?: storages_type;

  @ApiPropertyOptional({ enum: storages_status })
  @IsOptional()
  @IsEnum(storages_status)
  status?: storages_status;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000)
  depth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  pricing?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(-20)
  @Max(200)
  floor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(1000)
  row?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(1000)
  column?: number;
}

export class DeleteStorageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: '운영 안전성을 위해 물리 삭제하지 않으므로 항상 false입니다.',
  })
  deleted!: false;

  @ApiProperty({ enum: storages_status })
  status!: storages_status;
}
