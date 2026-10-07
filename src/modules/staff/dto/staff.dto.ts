import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ example: '주말 알바 민수', minLength: 1, maxLength: 30 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 30)
  name: string;
}

export class ListStaffQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  includeRevoked?: boolean;
}

export class RedeemInviteCodeDto {
  @ApiProperty({ example: 'ABCD-EFGH' })
  @IsString()
  @Length(1, 20)
  code: string;
}
