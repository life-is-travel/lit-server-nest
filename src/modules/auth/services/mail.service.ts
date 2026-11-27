import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  buildReservationCreatedMail,
  type ReservationCreatedMailContext,
} from './reservation-created-mail';

export type { ReservationCreatedMailContext } from './reservation-created-mail';

type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type ReviewRequestMailParams = {
  locale: string;
  storeName: string;
  customerName: string;
  reviewUrl: string;
};

@Injectable()
export class MailService {
  private static readonly REVIEW_REQUEST_TEMPLATES: Record<
    string,
    {
      subject: (store: string) => string;
      body: (p: { name: string; store: string; url: string }) => string;
    }
  > = {
    ko: {
      subject: (store) => `[LIT] ${store} 이용은 어떠셨나요?`,
      body: ({ name, store, url }) =>
        `${name}님, ${store}에서 짐을 찾아가신 것이 확인되었습니다.\n\n이용해 주셔서 감사합니다! 서비스가 어떠셨는지 들려주시면 다른 여행자에게 큰 도움이 됩니다.\n\n리뷰 남기기: ${url}\n\n(이 링크는 본인 예약 전용이며 14일간 유효합니다)`,
    },
    en: {
      subject: (store) => `[LIT] How was your experience at ${store}?`,
      body: ({ name, store, url }) =>
        `Hi ${name}, your luggage pickup at ${store} has been confirmed.\n\nThanks for using LIT! A quick review would help fellow travelers a lot.\n\nLeave a review: ${url}\n\n(This link is unique to your booking and valid for 14 days)`,
    },
    ja: {
      subject: (store) => `[LIT] ${store}のご利用はいかがでしたか？`,
      body: ({ name, store, url }) =>
        `${name}様、${store}でのお荷物のお引き取りを確認いたしました。\n\nご利用ありがとうございました！サービスのご感想をお聞かせいただけると、他の旅行者の大きな助けになります。\n\nレビューを書く: ${url}\n\n（このリンクはご本人の予約専用で、14日間有効です）`,
    },
    zh: {
      subject: (store) => `[LIT] 您在${store}的体验如何？`,
      body: ({ name, store, url }) =>
        `${name}您好，已确认您在${store}取回行李。\n\n感谢使用LIT！您的评价将为其他旅行者提供很大帮助。\n\n撰写评价: ${url}\n\n（此链接为您的预订专用，有效期14天）`,
    },
  };

  constructor(private readonly configService: ConfigService) {}

  async sendReviewRequestEmail(
    to: string,
    params: ReviewRequestMailParams,
  ): Promise<void> {
    const template =
      MailService.REVIEW_REQUEST_TEMPLATES[params.locale] ??
      MailService.REVIEW_REQUEST_TEMPLATES.en;
    await this.sendMail({
      to,
      subject: template.subject(params.storeName),
      text: template.body({
        name: params.customerName,
        store: params.storeName,
        url: params.reviewUrl,
      }),
    });
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    await this.sendMail({
      to: email,
      subject: '[Lit] 이메일 인증 코드',
      text: `[Lit] 이메일 인증 코드

인증 코드: ${code}

이 코드는 3분 내에만 유효합니다.

- Lit`,
    });
  }

  async sendReservationCreatedEmail(
    email: string,
    context: ReservationCreatedMailContext,
  ): Promise<void> {
    const mail = buildReservationCreatedMail(email, context);
    await this.sendMail({ to: email, ...mail });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
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
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
