import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGuestReviewDto {
  @ApiProperty() @IsString() @MaxLength(255) reservationId!: string;

  @ApiProperty({ description: '예약 조회 토큰 (알림 링크에 포함)' })
  @IsString()
  @MaxLength(255)
  token!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  // 매장 서비스·할인 별점 (선택) — 미이용/미평가 시 생략, NULL 저장
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  // 텍스트 리뷰는 선택 — 별점만으로 제출 가능 (2026-07-03, 외국인 이탈 방지).
  // 미입력 시 landing이 필드를 생략하고 DB에는 ''로 저장한다.
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ type: [String], description: 'R2 공개 URL, 최대 3장' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({}, { each: true })
  photoUrls?: string[];
}

export class GuestReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: '마스킹된 연락처 (010-****-5678 또는 ja****@example.com)' })
  customerName!: string;
  @ApiProperty() rating!: number;
  @ApiPropertyOptional() serviceRating?: number | null;
  @ApiProperty() comment!: string;
  @ApiProperty({ type: [String] }) photoUrls!: string[];
}
