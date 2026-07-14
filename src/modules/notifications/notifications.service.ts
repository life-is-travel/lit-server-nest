import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SolapiMessageService } from 'solapi';
import { PrismaService } from '../../common/database/prisma.service';
import { MailService } from '../auth/services/mail.service';
import { createOwnerActionToken } from '../owner-actions/owner-action-token.util';
import { getFirebaseMessaging } from './firebase-messaging';

export interface CheckoutNotificationData {
  reservationId: string;
  storeName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  locale: string;
  /** 프로토콜 없는 리뷰 URL — 알림톡 변수(https:// 고정)와 공유 */
  reviewPath: string;
}

export interface CreateNotificationData {
  reservationId: string;
  storeName: string;
  storeAddress: string;
  ownerPhone: string;
  /** 알림톡 추가 수신자 (stores.notification_phones) — 대표 번호와 중복 제거 후 발송 */
  additionalOwnerPhones?: string[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  luggageItems: Array<{ type: string; count: number }>;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalAmount: number;
  locale: string;
}

export interface PhotosNotificationData {
  reservationId: string;
  storeName: string;
  photoUrls: string[];
}

export interface ReviewCreatedNotificationData {
  reviewId: string;
  storeName: string;
  customerName: string;
  rating: number;
  comment: string;
  photoUrls: string[];
}

export interface OwnerReviewPushData {
  storeId: string;
  reviewId: string;
  storeName: string;
  customerName: string;
  rating: number;
  comment: string;
}

export interface CancelNotificationData {
  reservationId: string;
  customerPhone: string;
  storeName: string;
  ownerPhone: string;
  /** 알림톡 추가 수신자 (stores.notification_phones) — 대표 번호와 중복 제거 후 발송 */
  additionalOwnerPhones?: string[];
  luggageType: string; // reservations_requested_storage_type 값
  bagCount: number;
  startTime: Date;
  cancelledCount: number;
}

/** 짐 타입 코드 → 언어별 레이블 */
const LUGGAGE_LABELS: Record<string, Record<string, string>> = {
  ko: {
    s: '소형',
    m: '중형',
    l: '대형',
    xl: '특대',
    special: '특수',
    refrigeration: '냉장',
  },
  en: {
    s: 'Small',
    m: 'Medium',
    l: 'Large',
    xl: 'Extra Large',
    special: 'Special',
    refrigeration: 'Refrigerated',
  },
  ja: {
    s: '小型',
    m: '中型',
    l: '大型',
    xl: '特大',
    special: '特殊',
    refrigeration: '冷蔵',
  },
  zh: {
    s: '小型',
    m: '中型',
    l: '大型',
    xl: '特大',
    special: '特殊',
    refrigeration: '冷藏',
  },
};

/** locale → 알림에서 표시할 언어 이름 */
const LOCALE_LABELS: Record<string, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
  zh: '중국어',
};

/** 예약 ID의 마지막 6자리 대문자 코드 */
function shortCode(reservationId: string): string {
  const lastDash = reservationId.lastIndexOf('-');
  const tail =
    lastDash >= 0 ? reservationId.slice(lastDash + 1) : reservationId;
  return tail.slice(-6).toUpperCase();
}

/** Date → 한국 시간 포맷 (점주 알림 등 KO 고정) */
function formatKoreanDateTime(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** Date → locale에 맞는 시간 포맷 */
function formatLocalizedDateTime(date: Date, locale: string): string {
  try {
    const intlLocale =
      locale === 'zh'
        ? 'zh-CN'
        : locale === 'ja'
          ? 'ja-JP'
          : locale === 'en'
            ? 'en-US'
            : 'ko-KR';
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'Asia/Seoul',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * 단일 타입(취소 알림 등 레거시) → 한국어 짐 목록 문자열
 */
function buildLuggageList(luggageType: string, bagCount: number): string {
  const label = LUGGAGE_LABELS.ko[luggageType] ?? luggageType;
  return `${label} ${bagCount}개`;
}

/**
 * items 배열 → locale에 맞는 짐 목록 문자열
 */
function buildLuggageListFromItems(
  items: Array<{ type: string; count: number }>,
  locale: string,
): string {
  const labels = LUGGAGE_LABELS[locale] ?? LUGGAGE_LABELS.en;
  const unit =
    locale === 'ko'
      ? '개'
      : locale === 'ja'
        ? '個'
        : locale === 'zh'
          ? '件'
          : '';
  return items
    .map((item) => `${labels[item.type] ?? item.type} ${item.count}${unit}`)
    .join(', ');
}

/** 한국 번호 여부 판단 (010, 011, +82 등) */
function isKoreanPhone(phone: string): boolean {
  const n = phone.replace(/[\s\-.]/g, '');
  return /^(\+82|010|011|016|017|018|019)/.test(n);
}

/** Solapi to 필드 정규화 (+82-010... → 010...) */
function normalizePhoneForSolapi(phone: string): string {
  let n = phone.replace(/^\+82-?/, '');
  if (!n.startsWith('0')) n = '0' + n;
  return n.replace(/[^\d]/g, '');
}

/** 점주 알림 수신자 목록: 대표 번호 + 추가 수신자, 정규화 기준 중복 제거 */
function ownerRecipients(
  ownerPhone: string,
  additionalOwnerPhones?: string[],
): string[] {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const phone of [ownerPhone, ...(additionalOwnerPhones ?? [])]) {
    const normalized = normalizePhoneForSolapi(phone ?? '');
    // normalizePhoneForSolapi는 빈 문자열에 '0'을 붙이므로 실질 자릿수로 판별
    if (normalized.length < 9 || seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push(phone);
  }
  return recipients;
}

/** 예약 조회 URL 생성 */
function buildLookupUrl(phone: string, locale: string): string {
  const prefix = locale === 'ko' ? '' : `/${locale}`;
  const encoded = encodeURIComponent(phone.replace(/[\s\-.]/g, ''));
  return `https://www.lifeistravel.io${prefix}/reservations?phone=${encoded}`;
}

/** 고객 SMS 템플릿 (locale별) */
const SMS_TEMPLATES: Record<
  string,
  (p: {
    code: string;
    store: string;
    address: string;
    luggage: string;
    start: string;
    end: string;
    amount: string;
    url: string;
  }) => string
> = {
  ko: ({ code, store, address, luggage, start, end, amount, url }) =>
    `[LIT] 예약이 완료되었습니다!\n예약코드: ${code}\n매장: ${store}\n주소: ${address}\n짐 목록: ${luggage}\n보관 시작: ${start}\n픽업 예정: ${end}\n결제 금액: ${amount}\n예약 조회: ${url}\n즐거운 여행 되세요! ✈️\n문의: contact@lifeistravel.io`,
  en: ({ code, store, address, luggage, start, end, amount, url }) =>
    `[LIT] Reservation confirmed!\nCode: ${code}\nStore: ${store}\nAddress: ${address}\nLuggage: ${luggage}\nCheck-in: ${start}\nCheck-out: ${end}\nAmount: ${amount}\nLook up reservation: ${url}\nHave a great trip! ✈️\nQuestions? contact@lifeistravel.io`,
  ja: ({ code, store, address, luggage, start, end, amount, url }) =>
    `[LIT] ご予約が確定しました！\n予約コード: ${code}\n店舗: ${store}\n住所: ${address}\nお荷物: ${luggage}\n預け入れ: ${start}\nお引き取り: ${end}\n料金: ${amount}\n予約確認: ${url}\n素敵な旅を！✈️\nお問い合わせ: contact@lifeistravel.io`,
  zh: ({ code, store, address, luggage, start, end, amount, url }) =>
    `[LIT] 预订已确认！\n预订码: ${code}\n商店: ${store}\n地址: ${address}\n行李: ${luggage}\n寄存开始: ${start}\n取件时间: ${end}\n金额: ${amount}\n查询预订: ${url}\n祝您旅途愉快！✈️\n咨询: contact@lifeistravel.io`,
};

/** 체크아웃 리뷰 요청 SMS 템플릿 (알림톡 실패·해외번호 fallback) */
const REVIEW_SMS_TEMPLATES: Record<
  string,
  (p: { store: string; url: string }) => string
> = {
  ko: ({ store, url }) =>
    `[LIT] ${store}에서 짐을 찾아가신 것이 확인되었습니다.\n이용해 주셔서 감사합니다! 리뷰를 남겨주시면 다른 여행자에게 큰 도움이 됩니다.\n리뷰 남기기: ${url}`,
  en: ({ store, url }) =>
    `[LIT] Your luggage pickup at ${store} is confirmed.\nThanks for using LIT! A quick review helps fellow travelers.\nLeave a review: ${url}`,
  ja: ({ store, url }) =>
    `[LIT] ${store}でのお荷物のお引き取りを確認しました。\nご利用ありがとうございました！レビューが他の旅行者の助けになります。\nレビューを書く: ${url}`,
  zh: ({ store, url }) =>
    `[LIT] 已确认您在${store}取回行李。\n感谢使用LIT！您的评价将帮助其他旅行者。\n撰写评价: ${url}`,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 예약 취소 시 Discord embed + 카카오 알림톡(점주)을 발송합니다.
   * 환경변수 미설정 시 해당 채널을 스킵합니다. 채널별 실패는 여기서
   * error 로그로 남깁니다 (allSettled는 reject되지 않으므로 호출자 catch에 안 잡힘).
   */
  async sendCancelNotification(data: CancelNotificationData): Promise<void> {
    const results = await Promise.allSettled([
      this.sendDiscordCancelEmbed(data),
      this.sendKakaoCancelAlimtalk(data),
    ]);
    this.logSettledFailures(data.reservationId, results, [
      'discord',
      'kakao_owner',
    ]);
  }

  /** 점주 fan-out 결과 로깅 — 수신자별 실패는 warn, 성공 요약은 log. */
  private logOwnerFanoutResults(
    event: string,
    reservationId: string,
    recipients: string[],
    results: PromiseSettledResult<unknown>[],
  ): void {
    let sentCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn({
          event: `${event}_failed`,
          reservationId,
          recipient: recipients[index],
          err: result.reason as unknown,
        });
      } else {
        sentCount += 1;
      }
    });
    if (sentCount > 0) {
      this.logger.log({
        event,
        reservationId,
        recipientCount: recipients.length,
        sentCount,
      });
    }
  }

  /** allSettled 결과 중 rejected 채널을 error 로그로 기록합니다. */
  private logSettledFailures(
    reservationId: string,
    results: PromiseSettledResult<unknown>[],
    channels: string[],
  ): void {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error({
          event: 'notifications.channel_failed',
          channel: channels[index] ?? `unknown_${index}`,
          reservationId,
          err: result.reason as unknown,
        });
      }
    });
  }

  // ─── Discord ─────────────────────────────────────────────────────────

  private async sendDiscordCancelEmbed(
    data: CancelNotificationData,
  ): Promise<void> {
    const webhookUrl = this.configService.get<string>(
      'DISCORD_RESERVATION_WEBHOOK_URL',
    );
    if (!webhookUrl) {
      this.logger.debug(
        'DISCORD_RESERVATION_WEBHOOK_URL 미설정 — Discord 알림 스킵',
      );
      return;
    }

    const code = shortCode(data.reservationId);
    const luggageList = buildLuggageList(data.luggageType, data.bagCount);
    const startFormatted = formatKoreanDateTime(data.startTime);

    const embed = {
      title: `❌ 예약 취소 [${code}]`,
      color: 0xef4444,
      fields: [
        {
          name: '매장명',
          value: data.storeName || '(알 수 없음)',
          inline: true,
        },
        {
          name: '고객 연락처',
          value: data.customerPhone || '(없음)',
          inline: true,
        },
        { name: '예약코드', value: code, inline: true },
        { name: '짐 정보', value: luggageList, inline: true },
        { name: '보관 시작 시각', value: startFormatted, inline: true },
      ],
      footer: { text: '고객이 직접 취소함' },
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      throw new Error(`Discord webhook 실패: ${res.status} ${res.statusText}`);
    }

    this.logger.log({
      event: 'notifications.discord_cancel_sent',
      reservationId: data.reservationId,
    });
  }

  // ─── Kakao 알림톡 ─────────────────────────────────────────────────

  private async sendKakaoCancelAlimtalk(
    data: CancelNotificationData,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');
    const pfId = this.configService.get<string>('SOLAPI_KAKAO_PF_ID');
    const templateId = this.configService.get<string>(
      'SOLAPI_KAKAO_CANCEL_TEMPLATE_ID',
    );

    if (!apiKey || !apiSecret || !pfId || !templateId) {
      this.logger.debug('Solapi 환경변수 미설정 — 카카오 취소 알림톡 스킵');
      return;
    }

    const recipients = ownerRecipients(
      data.ownerPhone,
      data.additionalOwnerPhones,
    );
    if (recipients.length === 0) {
      this.logger.debug('ownerPhone 없음 — 카카오 취소 알림톡 스킵');
      return;
    }

    const code = shortCode(data.reservationId);
    const luggageList = buildLuggageList(data.luggageType, data.bagCount);
    const startFormatted = formatKoreanDateTime(data.startTime);
    const cancelTime = formatKoreanDateTime(new Date());

    const client = new SolapiMessageService(apiKey, apiSecret);

    // 수신자별 개별 발송 — 한 명 실패해도 나머지는 시도
    const results = await Promise.allSettled(
      recipients.map((to) =>
        client.send({
          to,
          kakaoOptions: {
            pfId,
            templateId,
            variables: {
              '#{reservation_code}': code,
              '#{customer_contact}': data.customerPhone,
              '#{luggage_list}': luggageList,
              '#{start_time}': startFormatted,
              '#{cancel_time}': cancelTime,
            },
          },
        }),
      ),
    );
    this.logOwnerFanoutResults(
      'notifications.kakao_cancel_sent',
      data.reservationId,
      recipients,
      results,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // 예약 생성 알림
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 예약 생성 시 Discord embed + 점주 알림톡 + 고객 알림(알림톡 or SMS)을 병렬 발송합니다.
   * 환경변수 미설정 채널은 스킵됩니다. 채널별 실패는 여기서 error 로그로 남깁니다.
   */
  async sendCreateNotification(data: CreateNotificationData): Promise<void> {
    const results = await Promise.allSettled([
      this.sendDiscordCreateEmbed(data),
      this.sendKakaoCreateAlimtalkToOwner(data),
      this.sendCustomerCreateNotification(data),
    ]);
    this.logSettledFailures(data.reservationId, results, [
      'discord',
      'kakao_owner',
      'customer',
    ]);
  }

  private async sendDiscordCreateEmbed(
    data: CreateNotificationData,
  ): Promise<void> {
    const webhookUrl = this.configService.get<string>(
      'DISCORD_RESERVATION_WEBHOOK_URL',
    );
    if (!webhookUrl) {
      this.logger.debug(
        'DISCORD_RESERVATION_WEBHOOK_URL 미설정 — Discord 예약 생성 알림 스킵',
      );
      return;
    }

    const code = shortCode(data.reservationId);
    const luggageList = buildLuggageListFromItems(data.luggageItems, 'ko');
    const startFormatted = formatKoreanDateTime(data.startTime);
    const endFormatted = formatKoreanDateTime(data.endTime);
    const amountText =
      data.totalAmount > 0
        ? `${data.totalAmount.toLocaleString('ko-KR')}원`
        : '현장결제';
    const localeLabel = LOCALE_LABELS[data.locale] ?? data.locale;

    const embed = {
      title: `🧳 새 예약! [${code}]`,
      color: 0x10b981,
      fields: [
        {
          name: '매장명',
          value: data.storeName || '(알 수 없음)',
          inline: true,
        },
        {
          name: '고객명/연락처',
          value: `${data.customerName} / ${data.customerPhone}`,
          inline: true,
        },
        { name: '예약코드', value: code, inline: true },
        { name: '짐 목록', value: luggageList || '(없음)', inline: true },
        { name: '보관 시작', value: startFormatted, inline: true },
        { name: '보관 종료', value: endFormatted, inline: true },
        { name: '금액', value: amountText, inline: true },
        { name: '언어', value: localeLabel, inline: true },
      ],
      footer: { text: '⚠️ 결제는 매장 현장 결제' },
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      throw new Error(`Discord webhook 실패: ${res.status} ${res.statusText}`);
    }

    this.logger.log({
      event: 'notifications.discord_create_sent',
      reservationId: data.reservationId,
    });
  }

  private async sendKakaoCreateAlimtalkToOwner(
    data: CreateNotificationData,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');
    const pfId = this.configService.get<string>('SOLAPI_KAKAO_PF_ID');
    const templateId = this.configService.get<string>(
      'SOLAPI_KAKAO_TEMPLATE_ID',
    );

    if (!apiKey || !apiSecret || !pfId || !templateId) {
      this.logger.debug('Solapi 환경변수 미설정 — 점주 예약 생성 알림톡 스킵');
      return;
    }

    const recipients = ownerRecipients(
      data.ownerPhone,
      data.additionalOwnerPhones,
    );
    if (recipients.length === 0) {
      this.logger.debug('ownerPhone 없음 — 점주 예약 생성 알림톡 스킵');
      return;
    }

    const code = shortCode(data.reservationId);
    const luggageList = buildLuggageListFromItems(data.luggageItems, 'ko');
    const startFormatted = formatKoreanDateTime(data.startTime);
    const endFormatted = formatKoreanDateTime(data.endTime);
    const amount =
      data.totalAmount > 0
        ? data.totalAmount.toLocaleString('ko-KR')
        : '현장결제';
    const language = LOCALE_LABELS[data.locale] ?? data.locale;

    const ownerActionSecret = this.configService.get<string>(
      'OWNER_ACTION_SECRET',
    );
    // 템플릿에 버튼(변수)이 아직 없어도 미사용 변수는 무시되므로 항상 전달해도 안전
    const actionUrl = ownerActionSecret
      ? `www.lifeistravel.io/o/${data.reservationId}?t=${createOwnerActionToken(data.reservationId, ownerActionSecret)}`
      : '';

    const client = new SolapiMessageService(apiKey, apiSecret);

    // 수신자별 개별 발송 — 한 명 실패해도 나머지는 시도.
    // 추가 수신자(직원 등)도 체크인 액션 링크를 받아 예약을 처리할 수 있다.
    const results = await Promise.allSettled(
      recipients.map((to) =>
        client.send({
          to,
          kakaoOptions: {
            pfId,
            templateId,
            variables: {
              '#{reservation_code}': code,
              '#{customer_contact}': data.customerPhone,
              '#{luggage_list}': luggageList,
              '#{start_time}': startFormatted,
              '#{end_time}': endFormatted,
              '#{amount}': amount,
              '#{customer_language}': language,
              '#{action_url}': actionUrl,
            },
          },
        }),
      ),
    );
    this.logOwnerFanoutResults(
      'notifications.kakao_create_owner_sent',
      data.reservationId,
      recipients,
      results,
    );
  }

  private async sendCustomerCreateNotification(
    data: CreateNotificationData,
  ): Promise<void> {
    const customerPhone = data.customerPhone;

    if (!customerPhone) {
      this.logger.debug('customerPhone 없음 — 고객 예약 생성 알림 스킵');
      return;
    }

    // 이메일로 예약한 외국인: SMS 불가
    if (customerPhone.includes('@')) {
      this.logger.debug('이메일 예약 — 고객 SMS 스킵');
      return;
    }

    const isKorean = isKoreanPhone(customerPhone) && data.locale === 'ko';

    if (isKorean) {
      // 한국 번호 + ko locale → 알림톡 먼저, 실패 시 LMS fallback
      const sent = await this.sendAlimtalkToCustomer(data);
      if (!sent) {
        await this.sendSmsToCustomer(data);
      }
    } else {
      // 해외 번호 → 국제 LMS
      await this.sendSmsToCustomer(data);
    }
  }

  private async sendAlimtalkToCustomer(
    data: CreateNotificationData,
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');
    const pfId = this.configService.get<string>('SOLAPI_KAKAO_PF_ID');
    const templateId = this.configService.get<string>(
      'SOLAPI_KAKAO_CUSTOMER_TEMPLATE_ID',
    );

    if (!apiKey || !apiSecret || !pfId || !templateId) {
      this.logger.debug('고객 알림톡 환경변수 미설정 — 알림톡 스킵');
      return false;
    }

    const code = shortCode(data.reservationId);
    const locale = data.locale;
    const luggageList = buildLuggageListFromItems(data.luggageItems, locale);
    const startFormatted = formatLocalizedDateTime(data.startTime, locale);
    const endFormatted = formatLocalizedDateTime(data.endTime, locale);
    const amount =
      data.totalAmount > 0
        ? data.totalAmount.toLocaleString('ko-KR')
        : '현장 결제';

    try {
      const client = new SolapiMessageService(apiKey, apiSecret);
      await client.send({
        to: normalizePhoneForSolapi(data.customerPhone),
        kakaoOptions: {
          pfId,
          templateId,
          variables: {
            '#{reservation_code}': code,
            '#{store_name}': data.storeName,
            '#{store_address}': data.storeAddress,
            '#{luggage_list}': luggageList,
            '#{start_time}': startFormatted,
            '#{end_time}': endFormatted,
            '#{amount}': amount,
            '#{customer_phone}': normalizePhoneForSolapi(data.customerPhone),
          },
        },
      });

      this.logger.log({
        event: 'notifications.kakao_create_customer_sent',
        reservationId: data.reservationId,
      });
      return true;
    } catch (err: unknown) {
      this.logger.warn({
        event: 'notifications.kakao_create_customer_failed',
        err,
      });
      return false;
    }
  }

  private async sendSmsToCustomer(data: CreateNotificationData): Promise<void> {
    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');
    const senderPhone = this.configService.get<string>('SOLAPI_SENDER_PHONE');

    if (!apiKey || !apiSecret || !senderPhone) {
      this.logger.debug('SOLAPI_SENDER_PHONE 미설정 — SMS 스킵');
      return;
    }

    const locale = data.locale;
    const code = shortCode(data.reservationId);
    const luggageList = buildLuggageListFromItems(data.luggageItems, locale);
    const startFormatted = formatLocalizedDateTime(data.startTime, locale);
    const endFormatted = formatLocalizedDateTime(data.endTime, locale);
    const amount =
      data.totalAmount > 0
        ? `₩${data.totalAmount.toLocaleString()}`
        : locale === 'ko'
          ? '현장 결제'
          : 'Pay at store';

    const lookupUrl = buildLookupUrl(data.customerPhone, locale);
    const template = SMS_TEMPLATES[locale] ?? SMS_TEMPLATES.en;
    const text = template({
      code,
      store: data.storeName,
      address: data.storeAddress,
      luggage: luggageList,
      start: startFormatted,
      end: endFormatted,
      amount,
      url: lookupUrl,
    });

    try {
      const client = new SolapiMessageService(apiKey, apiSecret);
      await client.send({
        to: normalizePhoneForSolapi(data.customerPhone),
        from: senderPhone,
        text,
        type: 'LMS',
      });

      this.logger.log({
        event: 'notifications.sms_create_customer_sent',
        reservationId: data.reservationId,
        locale,
      });
    } catch (err: unknown) {
      this.logger.warn({
        event: 'notifications.sms_create_customer_failed',
        err,
      });
    }
  }

  /**
   * 점주 체크아웃 시 고객 리뷰 요청.
   * 한국번호+ko → 알림톡(실패 시 LMS), 이메일 예약 → 이메일, 해외번호 → 이메일 우선 LMS fallback.
   * 채널 실패는 여기서 error 로그로 흡수하고 예외를 밖으로 던지지 않는다.
   */
  async sendCheckoutNotification(
    data: CheckoutNotificationData,
  ): Promise<void> {
    const reviewUrl = `https://${data.reviewPath}`;

    if (data.customerPhone.includes('@')) {
      await this.sendReviewRequestEmailSafely(
        data.customerEmail ?? data.customerPhone,
        data,
        reviewUrl,
      );
      return;
    }

    if (isKoreanPhone(data.customerPhone) && data.locale === 'ko') {
      const sent = await this.sendCheckoutAlimtalk(data);
      if (!sent) {
        await this.sendReviewSms(data, reviewUrl);
      }
      return;
    }

    if (data.customerEmail) {
      await this.sendReviewRequestEmailSafely(
        data.customerEmail,
        data,
        reviewUrl,
      );
      return;
    }
    await this.sendReviewSms(data, reviewUrl);
  }

  private async sendReviewRequestEmailSafely(
    email: string,
    data: CheckoutNotificationData,
    reviewUrl: string,
  ): Promise<void> {
    try {
      await this.mailService.sendReviewRequestEmail(email, {
        locale: data.locale,
        storeName: data.storeName,
        customerName: data.customerName,
        reviewUrl,
      });
      this.logger.log({
        event: 'notifications.review_email_sent',
        reservationId: data.reservationId,
        email,
      });
    } catch (err: unknown) {
      this.logger.error({
        event: 'notifications.channel_failed',
        channel: 'review_email',
        reservationId: data.reservationId,
        err,
      });
    }
  }

  private async sendCheckoutAlimtalk(
    data: CheckoutNotificationData,
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');
    const pfId = this.configService.get<string>('SOLAPI_KAKAO_PF_ID');
    const templateId = this.configService.get<string>(
      'SOLAPI_KAKAO_CHECKOUT_TEMPLATE_ID',
    );

    if (!apiKey || !apiSecret || !pfId || !templateId) {
      this.logger.debug('체크아웃 알림톡 환경변수 미설정 — 알림톡 스킵');
      return false;
    }

    try {
      const client = new SolapiMessageService(apiKey, apiSecret);
      await client.send({
        to: normalizePhoneForSolapi(data.customerPhone),
        kakaoOptions: {
          pfId,
          templateId,
          variables: {
            '#{store_name}': data.storeName,
            '#{review_url}': data.reviewPath,
          },
        },
      });

      this.logger.log({
        event: 'notifications.kakao_checkout_sent',
        reservationId: data.reservationId,
      });
      return true;
    } catch (err: unknown) {
      this.logger.warn({
        event: 'notifications.kakao_checkout_failed',
        err,
      });
      return false;
    }
  }

  private async sendReviewSms(
    data: CheckoutNotificationData,
    reviewUrl: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');
    const senderPhone = this.configService.get<string>('SOLAPI_SENDER_PHONE');

    if (!apiKey || !apiSecret || !senderPhone) {
      this.logger.debug('SOLAPI_SENDER_PHONE 미설정 — 리뷰 SMS 스킵');
      return;
    }

    const template =
      REVIEW_SMS_TEMPLATES[data.locale] ?? REVIEW_SMS_TEMPLATES.en;
    const text = template({ store: data.storeName, url: reviewUrl });

    try {
      const client = new SolapiMessageService(apiKey, apiSecret);
      await client.send({
        to: normalizePhoneForSolapi(data.customerPhone),
        from: senderPhone,
        text,
        type: 'LMS',
      });

      this.logger.log({
        event: 'notifications.review_sms_sent',
        reservationId: data.reservationId,
        locale: data.locale,
      });
    } catch (err: unknown) {
      this.logger.error({
        event: 'notifications.channel_failed',
        channel: 'review_sms',
        reservationId: data.reservationId,
        err,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 짐 사진 알림
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // 리뷰 생성 알림
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 리뷰 생성 시 Discord embed를 발송합니다.
   * 실패 시 throw — 호출자의 .catch()가 처리합니다.
   */
  async sendReviewCreatedNotification(
    data: ReviewCreatedNotificationData,
  ): Promise<void> {
    // 리뷰 전용 웹훅 우선, 없으면 예약 웹훅으로 폴백
    const webhookUrl =
      this.configService.get<string>('DISCORD_REVIEW_WEBHOOK_URL') ??
      this.configService.get<string>('DISCORD_RESERVATION_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.debug(
        'DISCORD_REVIEW_WEBHOOK_URL/DISCORD_RESERVATION_WEBHOOK_URL 미설정 — 리뷰 Discord 알림 스킵',
      );
      return;
    }

    const { rating, storeName, customerName, comment, photoUrls } = data;

    const photoLinks =
      photoUrls.length > 0
        ? photoUrls.map((url, i) => `[사진 ${i + 1}](${url})`).join('\n')
        : null;

    const embed: Record<string, unknown> = {
      title: `⭐ 새 리뷰 (${rating}/5) — ${storeName}`,
      color: 0xf59e0b,
      fields: [
        { name: '작성자', value: customerName || '(알 수 없음)', inline: true },
        { name: '별점', value: '⭐'.repeat(rating), inline: true },
        { name: '내용', value: comment.slice(0, 1000) },
        ...(photoLinks ? [{ name: '사진 링크', value: photoLinks }] : []),
      ],
      timestamp: new Date().toISOString(),
    };

    if (photoUrls[0]) {
      embed.image = { url: photoUrls[0] };
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      throw new Error(
        `Discord webhook 실패 (리뷰): ${res.status} ${res.statusText}`,
      );
    }

    this.logger.log({
      event: 'notifications.discord_review_sent',
      reviewId: data.reviewId,
    });
  }

  /**
   * 새 리뷰 도착 시 점주(lit-store 앱)에게 FCM 푸시를 발송합니다.
   * FIREBASE_SERVICE_ACCOUNT_JSON 미설정이면 warn 로그 없이 조용히 스킵합니다
   * (Discord 미설정 패턴과 동일 — 서버 기동/리뷰 생성에 영향 없음).
   * 만료·무효 토큰은 발송 응답에서 감지해 DB에서 청소합니다.
   */
  async sendOwnerReviewPush(data: OwnerReviewPushData): Promise<void> {
    const messaging = getFirebaseMessaging(
      this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'),
    );
    if (!messaging) {
      this.logger.debug(
        'FIREBASE_SERVICE_ACCOUNT_JSON 미설정 — 점주 리뷰 푸시 스킵',
      );
      return;
    }

    const tokenRows = await this.prisma.owner_push_tokens.findMany({
      where: { store_id: data.storeId },
      select: { token: true },
    });
    const tokens = tokenRows.map((row) => row.token);
    if (tokens.length === 0) {
      this.logger.debug({
        event: 'notifications.owner_push_no_tokens',
        storeId: data.storeId,
      });
      return;
    }

    const trimmed = data.comment.trim();
    const body = trimmed
      ? `${data.customerName}: ${trimmed.slice(0, 40)}`
      : `${data.customerName}님이 별점 ${data.rating}점을 남겼어요`;

    // FCM data 페이로드는 모든 값이 string이어야 함
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: `새 리뷰가 도착했어요 ⭐${data.rating}`,
        body,
      },
      data: {
        type: 'review_created',
        reviewId: data.reviewId,
        storeId: data.storeId,
      },
    });

    // 청소: 만료/무효 토큰 삭제
    const staleTokens: string[] = [];
    response.responses.forEach((res, index) => {
      if (res.success) return;
      const code = res.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokens.push(tokens[index]);
      }
    });
    if (staleTokens.length > 0) {
      await this.prisma.owner_push_tokens.deleteMany({
        where: { token: { in: staleTokens } },
      });
    }

    if (response.failureCount > 0) {
      this.logger.warn({
        event: 'notifications.owner_push_failed',
        storeId: data.storeId,
        reviewId: data.reviewId,
        failureCount: response.failureCount,
        staleRemoved: staleTokens.length,
      });
    }
    if (response.successCount > 0) {
      this.logger.log({
        event: 'notifications.owner_push_sent',
        storeId: data.storeId,
        reviewId: data.reviewId,
        sentCount: response.successCount,
        tokenCount: tokens.length,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 짐 사진 알림
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 짐 사진 저장 시 Discord embed만 발송합니다 (카카오 알림톡 없음).
   */
  async sendPhotosNotification(data: PhotosNotificationData): Promise<void> {
    await this.sendDiscordPhotosEmbed(data);
  }

  private async sendDiscordPhotosEmbed(
    data: PhotosNotificationData,
  ): Promise<void> {
    const webhookUrl = this.configService.get<string>(
      'DISCORD_RESERVATION_WEBHOOK_URL',
    );
    if (!webhookUrl) {
      this.logger.debug(
        'DISCORD_RESERVATION_WEBHOOK_URL 미설정 — 짐 사진 Discord 알림 스킵',
      );
      return;
    }

    const code = shortCode(data.reservationId);

    const photoLinks =
      data.photoUrls.length > 0
        ? data.photoUrls.map((url, i) => `[사진 ${i + 1}](${url})`).join('\n')
        : '공개 URL 없음 — objectKey로 저장됨';

    const embed: Record<string, unknown> = {
      title: `📷 짐 사진 [${code}]`,
      color: 0x3b82f6,
      fields: [
        {
          name: '매장명',
          value: data.storeName || '(알 수 없음)',
          inline: true,
        },
        { name: '예약 ID', value: data.reservationId, inline: true },
        { name: '사진 수', value: String(data.photoUrls.length), inline: true },
        { name: '사진 링크', value: photoLinks },
      ],
      timestamp: new Date().toISOString(),
    };

    if (data.photoUrls[0]) {
      embed.image = { url: data.photoUrls[0] };
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      throw new Error(
        `Discord webhook 실패 (짐 사진): ${res.status} ${res.statusText}`,
      );
    }

    this.logger.log({
      event: 'notifications.discord_photos_sent',
      reservationId: data.reservationId,
      photoCount: data.photoUrls.length,
    });
  }
}
