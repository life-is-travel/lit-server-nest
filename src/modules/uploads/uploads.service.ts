import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { R2StorageService } from '../../common/storage/r2-storage.service';
import {
  PresignUploadRequestDto,
  PresignUploadResponseDto,
} from './dto/presign-upload.dto';

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UploadsService {
  constructor(private readonly r2: R2StorageService) {}

  async presign(
    actorId: string,
    dto: PresignUploadRequestDto,
  ): Promise<PresignUploadResponseDto> {
    const ext = CONTENT_TYPE_TO_EXT[dto.contentType];

    if (!ext) {
      // DTO 단계에서 @IsIn으로 이미 걸러지므로 실질적으로 도달하지 않습니다.
      throw new BadRequestException({
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: `지원하지 않는 contentType입니다: ${dto.contentType}`,
      });
    }

    // objectKey: {folder}/{timestamp}-{uuid}.{ext}
    // actorId는 추후 감사 로그·접근 제어 확장 시 활용합니다.
    const folder = dto.folder.replace(/\/$/, '');
    const objectKey = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;

    const uploadUrl = await this.r2.getPresignedPutUrl(
      objectKey,
      dto.contentType,
      300, // 5분
    );

    const publicUrl = this.r2.getPublicUrl(objectKey) ?? undefined;

    return { uploadUrl, objectKey, publicUrl };
  }
}
