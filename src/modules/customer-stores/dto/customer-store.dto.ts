import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListCustomerStoresQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

export class CustomerStoreResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  slug!: string | null;

  @ApiProperty()
  businessName!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  phoneNumber!: string | null;

  @ApiPropertyOptional()
  address!: string | null;

  @ApiPropertyOptional()
  latitude!: number | null;

  @ApiPropertyOptional()
  longitude!: number | null;

  @ApiProperty({ type: [Object] })
  reviews!: Record<string, unknown>[];

  @ApiPropertyOptional({ type: Object })
  operatingHours!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  settings!: Record<string, unknown> | null;
}

export class CustomerStoreListResponseDto {
  @ApiProperty({ type: [CustomerStoreResponseDto] })
  items!: CustomerStoreResponseDto[];
}
