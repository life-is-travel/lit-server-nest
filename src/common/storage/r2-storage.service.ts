import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string | null;

  constructor(private readonly config: ConfigService) {
    const accountId = config.getOrThrow<string>('CF_R2_ACCOUNT_ID');
    this.bucket = config.getOrThrow<string>('CF_R2_BUCKET');
    this.publicUrl = config.get<string>('CF_R2_PUBLIC_URL') ?? null;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.getOrThrow<string>('CF_R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('CF_R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    this.logger.log({ event: 'r2.upload', key, bucket: this.bucket });

    // 퍼블릭 URL이 설정된 경우 바로 반환, 아니면 서명 URL 반환 (1시간)
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    return this.getSignedUrl(key, 3600);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log({ event: 'r2.delete', key, bucket: this.bucket });
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  /**
   * 클라이언트가 직접 R2에 파일을 업로드할 수 있는 PUT presigned URL을 발급합니다.
   * expiresIn 기본값은 5분(300초)입니다.
   */
  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    );
  }

  /**
   * 오브젝트의 퍼블릭 URL을 반환합니다.
   * CF_R2_PUBLIC_URL이 설정되지 않은 경우 null을 반환합니다.
   */
  getPublicUrl(key: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
  }
}
