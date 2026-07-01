import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

// folder 허용 prefix 목록
const ALLOWED_FOLDER_PREFIXES = ['stores/', 'reservations/', 'reviews/'];

export class PresignUploadRequestDto {
  /**
   * 업로드 대상 폴더입니다. stores/, reservations/, reviews/ 로 시작해야 합니다.
   * 예: "stores/hongdae", "reservations/2026-07", "reviews/general"
   */
  @ApiProperty({
    description:
      '업로드 대상 폴더. stores/ · reservations/ · reviews/ 중 하나로 시작해야 합니다.',
    example: 'reservations/2026-07',
  })
  @IsString()
  @MaxLength(200)
  @Matches(
    new RegExp(
      `^(${ALLOWED_FOLDER_PREFIXES.map((p) => p.replace('/', '\\/')).join('|')})`,
    ),
    {
      message: `folder는 ${ALLOWED_FOLDER_PREFIXES.join(', ')} 중 하나로 시작해야 합니다.`,
    },
  )
  folder!: string;

  /**
   * 원본 파일명입니다. objectKey 생성 시 ext 추출에만 사용됩니다.
   * 실제 저장 키는 UUID 기반으로 생성됩니다.
   */
  @ApiProperty({
    description: '원본 파일명 (확장자 추출에 사용됩니다).',
    example: 'luggage.jpg',
  })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    description: '업로드할 파일의 Content-Type.',
    enum: ALLOWED_CONTENT_TYPES,
  })
  @IsIn(ALLOWED_CONTENT_TYPES, {
    message: `contentType은 ${ALLOWED_CONTENT_TYPES.join(', ')} 중 하나여야 합니다.`,
  })
  contentType!: AllowedContentType;
}

export class PresignUploadResponseDto {
  @ApiProperty({
    description: '파일을 직접 PUT 업로드할 수 있는 presigned URL (유효 5분).',
  })
  uploadUrl!: string;

  @ApiProperty({
    description: '업로드 후 서버에 전달할 objectKey입니다.',
    example: 'reservations/2026-07/1751234567890-550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  objectKey!: string;

  @ApiPropertyOptional({
    description:
      'CF_R2_PUBLIC_URL이 설정된 경우 업로드 완료 후 접근 가능한 퍼블릭 URL입니다.',
  })
  publicUrl?: string;
}
