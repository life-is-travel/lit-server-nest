import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASSWORD');

    if (!user || !pass) {
      throw new ServiceUnavailableException({
        code: 'EMAIL_CONFIG_MISSING',
        message: '이메일 발송 설정이 누락되었습니다.',
      });
    }

    const transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('EMAIL_HOST'),
      port: this.configService.getOrThrow<number>('EMAIL_PORT'),
      secure: this.configService.getOrThrow<boolean>('EMAIL_SECURE'),
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: this.configService.getOrThrow<string>('EMAIL_FROM'),
      to: email,
      subject: '[Lit] 이메일 인증 코드',
      text: `[Lit] 이메일 인증 코드

인증 코드: ${code}

이 코드는 3분 내에만 유효합니다.

- Lit`,
    });
  }
}
