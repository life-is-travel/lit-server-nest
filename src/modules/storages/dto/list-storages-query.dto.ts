import { ApiPropertyOptional } from '@nestjs/swagger';
import { storages_status, storages_type } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { optionalNumber } from '../../../common/transformers/legacy-input.transformer';

export class ListStoragesQueryDto {
  @ApiPropertyOptional({ enum: storages_status })
  @IsOptional()
  @IsEnum(storages_status)
  status?: storages_status;

  @ApiPropertyOptional({ enum: storages_type })
  @IsOptional()
  @IsEnum(storages_type)
  type?: storages_type;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
