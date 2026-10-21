import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

const FIREBASE_APP_NAME = 'lit-store-push';

/** 기기에서 지워졌거나 잘못된 토큰 — 다시 보내도 실패하므로 DB에서 지운다. */
const STALE_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface PushMessage {
  title: string;
  body: string;
  /** 앱이 알림을 눌렀을 때 화면을 고르는 값. FCM data는 문자열만 허용한다. */
  data: Record<string, string>;
}

export interface PushSendResult {
  successCount: number;
  staleTokens: string[];
}

/**
 * firebase-admin FCM 발송 래퍼.
 * FIREBASE_SERVICE_ACCOUNT_BASE64 미설정 시 발송을 건너뛴다(알림톡 채널과 같은 규칙).
 */
@Injectable()
export class FcmSenderService {
  private readonly logger = new Logger(FcmSenderService.name);
  private messaging: Messaging | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  async send(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    const messaging = this.getMessaging();
    if (!messaging || tokens.length === 0) {
      return { successCount: 0, staleTokens: [] };
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: {
        priority: 'high',
        // 앱(FcmService)이 만드는 채널과 같은 ID
        notification: { channelId: 'default_channel', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    const staleTokens: string[] = [];
    response.responses.forEach((result, index) => {
      const code = result.error?.code;
      if (code && STALE_TOKEN_ERROR_CODES.has(code)) {
        staleTokens.push(tokens[index]);
      } else if (result.error) {
        this.logger.warn({
          event: 'push.send_failed',
          code,
          message: result.error.message,
        });
      }
    });

    return { successCount: response.successCount, staleTokens };
  }

  private getMessaging(): Messaging | null {
    if (this.messaging !== undefined) {
      return this.messaging;
    }

    const encoded = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_BASE64',
    );
    if (!encoded) {
      this.logger.debug('FIREBASE_SERVICE_ACCOUNT_BASE64 미설정 — 푸시 스킵');
      this.messaging = null;
      return null;
    }

    try {
      const serviceAccount = JSON.parse(
        Buffer.from(encoded, 'base64').toString('utf8'),
      ) as Record<string, string>;
      const app = getApps().some((a) => a.name === FIREBASE_APP_NAME)
        ? getApp(FIREBASE_APP_NAME)
        : initializeApp(
            {
              credential: cert({
                projectId: serviceAccount.project_id,
                clientEmail: serviceAccount.client_email,
                privateKey: serviceAccount.private_key,
              }),
            },
            FIREBASE_APP_NAME,
          );
      this.messaging = getMessaging(app);
    } catch (err) {
      this.logger.error('Firebase 서비스 계정 초기화 실패 — 푸시 비활성', err);
      this.messaging = null;
    }
    return this.messaging;
  }
}
