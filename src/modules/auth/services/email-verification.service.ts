import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  generateCode(): string {
    const codeLength = this.configService.getOrThrow<number>(
      'EMAIL_VERIFICATION_CODE_LENGTH',
    );
    const min = 10 ** (codeLength - 1);
    const max = 10 ** codeLength - 1;

    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  getExpiresInSeconds(): number {
    return this.configService.getOrThrow<number>(
      'EMAIL_VERIFICATION_CODE_EXPIRES_IN',
    );
  }

  async saveCode(email: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.getExpiresInSeconds() * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.email_verifications.deleteMany({
        where: {
          email,
          is_verified: false,
        },
      });

      await tx.email_verifications.create({
        data: {
          email,
          code,
          expires_at: expiresAt,
          is_verified: false,
          attempt_count: 0,
        },
      });
    });
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const maxAttempts = this.configService.getOrThrow<number>(
      'EMAIL_VERIFICATION_MAX_ATTEMPTS',
    );
    const verification = await this.prisma.email_verifications.findFirst({
      where: { email },
      orderBy: { created_at: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException({
        code: 'VERIFICATION_FAILED',
        message: '인증 코드를 찾을 수 없습니다.',
        details: { email },
      });
    }

    if (verification.is_verified) {
      throw new BadRequestException({
        code: 'VERIFICATION_FAILED',
        message: '이미 사용된 코드입니다.',
        details: { email },
      });
    }

    if ((verification.attempt_count ?? 0) >= maxAttempts) {
      throw new BadRequestException({
        code: 'VERIFICATION_FAILED',
        message:
          '최대 시도 횟수를 초과했습니다. 새로운 인증 코드를 요청하세요.',
        details: { email },
      });
    }

    if (verification.expires_at <= new Date()) {
      throw new BadRequestException({
        code: 'VERIFICATION_FAILED',
        message: '인증 코드가 만료되었습니다. 새로운 코드를 요청하세요.',
        details: { email },
      });
    }

    if (verification.code !== code) {
      await this.prisma.email_verifications.update({
        where: { id: verification.id },
        data: {
          attempt_count: {
            increment: 1,
          },
        },
      });

      throw new BadRequestException({
        code: 'VERIFICATION_FAILED',
        message: '인증 코드가 일치하지 않습니다.',
        details: { email },
      });
    }

    await this.prisma.email_verifications.update({
      where: { id: verification.id },
      data: { is_verified: true },
    });
  }

  async assertEmailVerified(email: string): Promise<void> {
    const verification = await this.prisma.email_verifications.findFirst({
      where: { email },
      orderBy: { created_at: 'desc' },
    });

    if (!verification?.is_verified) {
      throw new BadRequestException({
        code: 'EMAIL_NOT_VERIFIED',
        message: verification
          ? '이메일 인증이 완료되지 않았습니다.'
          : '이메일 인증이 필요합니다.',
        details: { email },
      });
    }
  }

  toSaveError(error: unknown): InternalServerErrorException {
    return new InternalServerErrorException({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : '인증 코드 저장 실패',
    });
  }
}
