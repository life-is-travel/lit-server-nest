import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

/**
 * lit-store 점주 앱 FCM 발송용 firebase-admin lazy singleton.
 *
 * - `FIREBASE_SERVICE_ACCOUNT_JSON`(서비스 계정 JSON 문자열 또는 base64)이
 *   없거나 파싱 불가면 초기화하지 않고 `null`을 반환한다 → 발송 측이 조용히 스킵.
 * - 서버 기동 시점에 초기화하지 않으므로, env 미설정이 서버 부팅을 막지 않는다.
 */

const FIREBASE_APP_NAME = 'lit-fcm';

let cachedMessaging: Messaging | null = null;

/** JSON 문자열 또는 base64 인코딩 JSON을 서비스 계정 객체로 파싱 (둘 다 시도) */
function parseServiceAccount(raw: string): ServiceAccount | null {
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    // base64 디코드 실패 — 원본만 시도
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // 다음 후보 시도
    }
  }

  return null;
}

/**
 * FCM Messaging 인스턴스를 반환한다. 초기화 불가(=env 미설정/파싱 실패)면 `null`.
 * 한 번 성공하면 이후 호출은 캐시된 인스턴스를 재사용한다.
 */
export function getFirebaseMessaging(
  serviceAccountJson: string | undefined,
): Messaging | null {
  if (cachedMessaging) {
    return cachedMessaging;
  }

  if (!serviceAccountJson) {
    return null;
  }

  const serviceAccount = parseServiceAccount(serviceAccountJson);
  if (!serviceAccount) {
    return null;
  }

  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  const app =
    existing ??
    initializeApp({ credential: cert(serviceAccount) }, FIREBASE_APP_NAME);

  cachedMessaging = getMessaging(app);
  return cachedMessaging;
}
