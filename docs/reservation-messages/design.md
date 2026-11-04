---
작성: 2026-11-04
상태: 확정본 — 결정 5개 확정(2026-11-04), 서버 검토·구현용
관련: [기능 PRD](./prd.md) · 화면 초안 12장(점주 앱 6 · 랜딩 6)은 저장소 밖에서 따로 공유
기준 코드: lit-server-nest origin/main `ae110d4` (2026-10-28, #111 머지 시점)
---

# 예약 메시지(자동 번역) — 서버 설계

## 0. 한 줄 요약
예약마다 대화방 하나. 손님(랜딩 비회원)은 **기존 예약 토큰(`qr_code`)**으로, 점주·직원은 **기존 `StoreAuthGuard`**로 접근한다. 메시지는 **보낼 때 한 번 번역해 저장**하고, 실시간 연결 없이 **폴링 + 매장 푸시 + 손님 메일**로 알린다.

새 테이블 2개, 손님 API 2개, 점주 API 3개, 크론 2개, 외부 의존성은 번역 API 하나.

## 1. 이미 있는 것 (재사용)
| 필요 | 기존 코드 |
|---|---|
| 비회원 본인 확인 | `GET /api/guest/reservations/:id?token=` — `reservations.qr_code = token`으로 조회 (`guest-reservation.service.ts` `getReservation`). 결제 완료·리뷰 링크가 이미 이 방식 |
| 예약 묶음 | `reservation_group_id` — 한 번 예약한 여러 행(짐 종류별)이 같은 그룹·같은 `qr_code` |
| 손님 언어 | `reservations.locale` (ko/en/ja/zh) |
| 점주·직원 인증 | `@UseGuards(StoreAuthGuard)` + `@CurrentStoreId()` + `@StaffAllowed()` |
| 매장 푸시 | `StorePushService.notifyStore(storeId, PushMessage)` (#110) |
| 손님 메일 | `MailService.sendMail` + 4개 언어 템플릿 패턴(`RESERVATION_MAIL_TEMPLATES`) |
| 스케줄러 | `@nestjs/schedule` `@Cron` (공휴일 동기화에서 사용 중) |
| 요청 제한 | `AuthThrottlerGuard` 패턴 |
| 영업시간 | `store_operating_hours` (+ `break_times`) |

## 2. 핵심 결정
1. **대화방 단위 = 예약 그룹.** `reservation_group_id`가 있으면 그룹 하나에 대화방 하나, 없으면 예약 행 하나에 하나. 짐을 3종류로 나눠 예약해도 대화는 하나.
2. **토큰 = 기존 `qr_code`.** 새 토큰을 만들지 않는다. 이메일·전화번호 조회(`GET /api/guest/reservations?email=`)로는 대화를 열 수 없다 — 이메일만 알면 남의 대화를 읽게 되기 때문.
3. **번역은 보낼 때 1회, 결과를 저장.** 볼 때마다 번역하지 않는다(비용·지연·결과 흔들림 방지). 빠른 답장은 서버 상수(4개 언어 문장)에서 꺼내 번역 API를 거치지 않는다.
4. **실시간 연결 없음.** 대화 화면이 열린 동안 클라이언트가 `after=<마지막 메시지 id>`로 10초마다 조회. 화면 밖은 푸시(점주)·메일(손님).
5. **읽음 표시 없음.** 점주의 "답 필요" = 마지막 메시지를 손님이 보냈음. 손님의 "새 답장" = 손님이 마지막으로 본 시각 이후 점주 메시지가 있음.
6. **대화방이 열려 있는 조건은 매번 계산**(닫는 크론 불필요): 예약 상태가 `confirmed`·`in_progress`이거나, `completed`이고 `actual_end_time + 24h`가 지나지 않음. `cancelled`·`rejected`·`no_show`·`pending*`이면 닫힘(읽기만).

## 3. 데이터 모델

### 3.1 `reservation_threads`
```sql
-- 예약(그룹)당 대화방 하나. reservation_id는 그룹의 대표 행(가장 먼저 만든 행).
-- 콜레이션: reservations.id와 외래키로 이어지므로 reservations 테이블과 같은 콜레이션으로 맞출 것(#107 때 겪은 문제).
--   저장소 마이그레이션에는 reservations 생성 SQL이 없다(초기 스키마) → 운영 DB에서 SHOW TABLE STATUS LIKE 'reservations'로 확인 후 명시.
CREATE TABLE `reservation_threads` (
  `id`                      VARCHAR(36)  NOT NULL,
  `store_id`                VARCHAR(255) NOT NULL,
  `reservation_id`          VARCHAR(255) NOT NULL,
  `reservation_group_id`    VARCHAR(255) NULL,
  `customer_locale`         VARCHAR(5)   NOT NULL DEFAULT 'en',
  `last_message_at`         DATETIME     NULL,
  `last_sender`             ENUM('customer','store') NULL,
  `customer_last_seen_at`   DATETIME     NULL,
  `customer_mail_due_at`    DATETIME     NULL,   -- 손님에게 보낼 답장 메일 예약 시각(묶음)
  `store_push_pending`      TINYINT(1)   NOT NULL DEFAULT 0, -- 영업시간 밖에 온 손님 메시지 → 열 때 푸시
  `created_at`              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_thread_reservation` (`reservation_id`),
  UNIQUE KEY `uniq_thread_group` (`reservation_group_id`),
  KEY `idx_thread_store_last` (`store_id`, `last_sender`, `last_message_at`),
  KEY `idx_thread_mail_due` (`customer_mail_due_at`),
  CONSTRAINT `reservation_threads_store_fk` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reservation_threads_reservation_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE
);
```
- `uniq_thread_group`은 NULL을 여러 개 허용(MySQL)하므로 그룹 없는 예약도 문제없다.
- 대화방은 **첫 메시지를 보낼 때 만든다**(upsert). 대부분 예약은 대화가 없으므로 미리 만들지 않는다.

### 3.2 `reservation_messages`
```sql
CREATE TABLE `reservation_messages` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `thread_id`        VARCHAR(36)  NOT NULL,
  `sender`           ENUM('customer','store') NOT NULL,
  `sender_staff_id`  VARCHAR(255) NULL,         -- 직원이 보냈으면 기록(점주면 NULL)
  `kind`             ENUM('text','quick') NOT NULL DEFAULT 'text',  -- 오는 길 카드는 2차(#68 이후)에 값 추가
  `quick_code`       VARCHAR(40)  NULL,
  `body`             TEXT         NOT NULL,     -- 보낸 사람 언어 원문 (최대 1,000자)
  `body_locale`      VARCHAR(5)   NOT NULL,
  `translated_body`  TEXT         NULL,         -- 받는 사람 언어
  `translated_locale` VARCHAR(5)  NULL,
  `translate_status` ENUM('ok','failed','skipped') NOT NULL,  -- skipped = 같은 언어 / 빠른 답장
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_thread_id` (`thread_id`, `id`),
  CONSTRAINT `reservation_messages_thread_fk` FOREIGN KEY (`thread_id`) REFERENCES `reservation_threads` (`id`) ON DELETE CASCADE
);
```
- 빠른 답장은 `quick_code`만 보고 받는 쪽 언어 문장을 상수에서 꺼내 `translated_body`에 넣는다.
- `id`가 자동 증가라 폴링은 `after=<id>`로 단순하게.

### 3.3 빠른 답장 상수 (서버 코드, 4개 언어)
```ts
// src/modules/reservation-messages/quick-replies.ts
export const QUICK_REPLIES = {
  store: {
    ok:            { ko: '네, 괜찮아요', en: "Sure, that's fine", ja: 'はい、大丈夫です', zh: '好的，没问题' },
    come_2f:       { ko: '2층으로 오세요', en: 'Please come up to the 2nd floor', ja: '2階へお越しください', zh: '请到二楼' },
    tell_counter:  { ko: '도착하면 카운터에 말씀해 주세요', en: '...', ja: '...', zh: '...' },
    closing_at:    { ko: '오늘은 {time}에 닫아요', ... },   // {time}은 오늘 영업 종료 시각으로 채움
  },
  customer: {
    late:        { ko: '조금 늦을 것 같아요', ... },
    where_entry: { ko: '입구가 어디예요?', ... },
    on_my_way:   { ko: '지금 가는 중이에요', ... },
    early_pick:  { ko: '일찍 찾으러 가도 되나요?', ... },
  },
} as const;
```
- "2층으로 오세요"처럼 매장마다 다른 문장은 나중에 매장별 설정으로(1차는 기본 문장만).
- 외국어 문장은 **사람이 한 번 검수**한다(번역 API 결과를 그대로 넣지 않음).

## 4. API

### 4.1 손님 (랜딩 비회원, 토큰)
`GuestReservationMessagesController` — `@Controller('api/guest/reservations')`

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/:id/messages?token=&after=` | 대화 조회. `after` 없으면 최근 50개. 호출 시 `customer_last_seen_at = now`, 대기 중인 답장 메일 취소 |
| POST | `/:id/messages?token=` | 보내기. body `{ text }` 또는 `{ quickCode }` |

GET 응답(손님 언어 기준으로 이미 골라서 준다):
```json
{
  "thread": { "open": true, "closesAt": null, "storeOpenNow": false, "nextOpenAt": "2026-11-08T11:00:00+09:00" },
  "store": { "name": "오후세시 커피" },
  "messages": [
    { "id": 812, "sender": "store", "kind": "quick", "text": "はい、大丈夫です", "original": null, "translateFailed": false, "createdAt": "..." }
  ],
  "quickReplies": [{ "code": "late", "text": "少し遅れそうです" }]
}
```
- `text`는 손님이 보낸 건 원문, 점주가 보낸 건 번역문(실패면 원문 + `translateFailed: true`). `original`은 번역된 경우에만.
- **응답에 매장 전화번호·손님 이메일·전화번호를 넣지 않는다.**
- 토큰 확인은 기존 `getReservation`과 같은 조건(`id` + `qr_code`), 그룹이면 대표 행으로 대화방을 찾는다.
- POST 검증: 1,000자 초과 → 400 `MESSAGE_TOO_LONG`, 닫힌 대화방 → 409 `THREAD_CLOSED`, 요청 제한 10분 20건 → 429.

### 4.2 점주·직원
`@UseGuards(StoreAuthGuard)` + `@StaffAllowed()` — 직원도 답장 가능(결정 §8-2), 직원이 보내면 `sender_staff_id` 기록

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/store/message-threads?needsReply=true` | 홈 "답 기다리는 메시지"·예약 탭 배지용. 각 항목 `{ reservationId, customerName, startTime, lastMessage(한국어), lastMessageAt }` |
| GET | `/api/store/reservations/:id/messages?after=` | 대화 조회(한국어 기준). 응답 모양은 4.1과 같고 `text`가 한국어 |
| POST | `/api/store/reservations/:id/messages` | `{ text }` / `{ quickCode }` |

- 예약 목록 API(`GET /api/reservations`) 응답에 `needsReply: boolean`을 더하면 앱이 예약마다 따로 부르지 않아도 된다(그룹 단위로 계산).
- "오는 길 보내기"는 **1차에서 뺀다**(결정 §8-3). 2차에서 #68(`store_settings.directions_text/photos`) 이후 `kind`에 `directions` + `payload JSON` 컬럼을 추가한다.

## 5. 번역
### 5.1 흐름 (POST 안에서 동기 처리)
1. 받는 사람 언어 결정: 손님→점주 = `ko`, 점주→손님 = `thread.customer_locale`.
2. 같은 언어면 `skipped`. 빠른 답장이면 상수에서 꺼내 `skipped`.
3. 아니면 번역 API 호출 — **타임아웃 3초**, 실패하면 `translate_status = failed`로 저장하고 원문을 그대로 전달(손님·점주 화면에 "번역하지 못했어요").
4. 원문 언어는 보낸 사람 쪽 언어로 가정(손님 = `reservations.locale`, 점주 = `ko`). 손님이 예약 언어와 다른 언어로 써도 대부분 엔진이 자동 감지하므로 `source`는 비워서 보낸다.

### 5.2 엔진 후보 — 인터페이스 하나로 감싸 교체 가능하게
```ts
interface TranslationProvider { translate(text: string, target: 'ko'|'en'|'ja'|'zh'): Promise<{ text: string; detected?: string }> }
```
| 엔진 | 장점 | 단점 |
|---|---|---|
| Google Cloud Translation (기본 v2) | API 키 하나, 무료 구간 있음, 4개 언어 안정 | 짐 보관 맥락(맡기기·찾기)을 모름 |
| DeepL API | 일본어·영어 품질 평이 좋음, 무료 플랜 있음 | 한국어 지원은 비교적 최근 |
| Papago(네이버 클라우드) | 한국어 강점 | 콘솔·과금 구조가 번거로움 |
| Claude Haiku (LLM) | "짐을 찾다 = pick up" 같은 맥락·말투 지시 가능 | 응답 지연·비용 변동, 프롬프트 관리 필요 |

- **결정(§8-1): 가장 싼 쪽 → 1차는 Google Cloud Translation 기본(v2).** 매달 50만 자까지 무료, 넘으면 100만 자당 약 $20(2026-11 기준 기억값 — 결제 계정 만들 때 콘솔에서 다시 확인). 무료라도 결제 계정(카드) 등록이 필요하다.
- DeepL 무료 플랜도 월 50만 자지만, 무료 플랜은 보낸 글을 품질 개선에 쓸 수 있다는 조건이 있는 것으로 안다(가입 시 약관 확인) — 손님 대화를 보내기엔 부담이라 제외.
- 규모 감: 메시지 평균 60자 × 월 2,000건 ≈ 12만 자 = 무료 한도(50만 자)의 4분의 1. 무료를 넘으려면 월 약 8,000건(지금의 4배)이 필요하다.
- 빠른 답장은 API를 부르지 않으므로 실제 사용량은 이보다 적다.
- 품질 불만이 쌓이면 Provider만 바꿔 LLM으로 교체.
- 환경 변수: `TRANSLATION_PROVIDER`, `TRANSLATION_API_KEY` → `env.validation.ts`에 선택 항목으로 추가(없으면 번역 없이 원문 전달 — 개발 환경에서 키 없이 동작).

## 6. 알림
### 6.1 손님 → 점주: 매장 푸시
- 영업 중이면 즉시 `notifyStore(storeId, { title: '손님 메시지 · 사토 유카', body: <한국어 번역 앞 60자>, data: { type: 'reservation_message', reservationId } })`.
- **영업시간 밖이면 보류**: `store_push_pending = 1`. 크론(10분마다)이 "지금 영업 중 + pending" 대화방을 모아 **한 번만** "밤사이 손님 메시지 N개" 푸시. (밤 11시에 사장님 폰을 울리지 않기 위함)
- **실현 가능성 확인(2026-11-04, origin/main `ae110d4` + 운영 API):**
  - 서버에는 "지금 영업 중?" 함수가 **없다**. 예약 생성도 영업시간을 검사하지 않음(`reservation-command.service.ts`는 `closed_at`만 확인). 푸시(`StorePushService.notifyStore`)에도 조용한 시간 개념 없음 → 새로 만들어야 한다.
  - 데이터는 충분하다: `store_operating_hours`(요일별 open/close/operating, `is_24_hours`, `break_times`, `holiday_start/end_date` 임시휴무, `public_holiday_hours`) + `public_holidays` 테이블(#105, 특일 API 동기화).
  - 운영 매장 21곳 전부 영업시간 있음. 자정 넘기는 매장·24시간 매장 0곳, 브레이크타임 쓰는 매장 0곳. 가장 이른 오픈 08:00, 가장 늦은 마감 23:00.
  - 랜딩에 같은 판단 로직이 이미 있다: `landing/lib/store-hours.ts`의 `calcStoreOpenState`(156줄, 테스트 10개 — 임시휴무·공휴일·브레이크 포함). **이걸 서버 순수 함수 `isStoreOpenAt(hours, isPublicHoliday, now)`로 옮기고 테스트도 같이 옮긴다** → 손님 화면 "지금은 영업시간이 아니에요"와 푸시 보류가 같은 기준을 쓴다.
  - 주의: Prisma `TIME` 값은 `1970-01-01T12:00:00.000Z`처럼 오므로 `getUTCHours()`로 읽는다(벽시계 시각). 현재 시각은 KST로 계산. 공휴일 규칙 `isOperating: true` + 시간 null(3곳)은 "평소와 동일"로 본다. 영업시간 행이 없는 매장은 **즉시 발송**(안전한 쪽).
  - 보류된 알림은 오픈 후 크론 주기(10분) 안에 1회 발송된다.

### 6.2 점주 → 손님: 답장 메일 (묶음)
- 점주가 보내면 `customer_mail_due_at`이 비어 있을 때만 `now + 3분`으로 설정.
- 크론(1분마다): `customer_mail_due_at <= now`인 대화방 → 손님이 그 사이 대화를 열어 봤으면(`customer_last_seen_at`이 마지막 점주 메시지 이후) **보내지 않고 비움**, 아니면 `customer_last_seen_at` 이후 점주 메시지를 모아 메일 한 통.
- 메일: 4개 언어 템플릿(기존 `RESERVATION_MAIL_TEMPLATES` 패턴), 제목 "{매장}에서 답장이 왔어요", 본문에 답장 전문(손님 언어), 링크 `https://www.lifeistravel.io/{locale}/reservations/{reservationId}/chat?token={qr_code}` (리뷰 링크와 같은 토큰 방식).
- 손님 이메일이 없는 예약(전화번호로만 예약한 국내 손님)은 메일 대신 기존 알림톡 경로를 검토 — 1차 범위 밖.

### 6.3 나중 (1차 범위 밖)
- 랜딩에는 웹 푸시 코드(`lib/pushSubscription.ts`)와 DB 테이블(`push_subscriptions`)이 남아 있지만 **현재 서버에 `/api/guest/push/*` 엔드포인트가 없어 동작하지 않는다**(운영 404 확인). 메일로 시작하고, 웹 푸시는 따로 살릴지 결정.

## 7. 보관·개인정보·운영
- 닫힌 대화방(§2-6 기준) 90일 뒤 메시지 삭제 — 하루 1회 크론.
- 서버 로그에 메시지 본문을 남기지 않는다(id·길이만).
- 개인정보 처리방침 갱신 필요: 수집 항목(대화 내용), 보관 기간(대화 종료 후 90일), **처리 위탁(번역 서비스 업체)**. 랜딩 `/privacy`·`/partner-privacy` 4개 언어.
- **관리자 웹(lit-admin)에는 대화 열람 기능을 만들지 않는다**(결정 §8-5, 개인정보 최소화). 분쟁 시에는 기존 고객센터 문의로 처리한다. DB 직접 조회는 서버 담당자만 가능.

## 8. 결정 사항 (2026-11-04)
1. 번역 엔진 → **가장 싼 것: Google Cloud Translation 기본(v2)**. 예상 사용량은 무료 한도 안(§5.2).
2. 직원도 답장 → **허용**. `sender_staff_id` 기록.
3. "오는 길 보내기" → **1차 제외**. #68 이후 2차.
4. 영업시간 밖 푸시 보류 → **적용**. 랜딩 `calcStoreOpenState`를 서버로 이식해 같은 기준 사용(§6.1 '실현 가능성').
5. 관리자 대화 열람 → **만들지 않음**(개인정보 최소화 원칙).

## 9. 작업 순서
1. 서버: 마이그레이션 2개 → 모듈 `reservation-messages`(서비스·손님/점주 컨트롤러·번역 Provider·크론 2개) → 예약 목록 `needsReply` → 테스트.
2. 서버 배포 후 병렬:
   - 랜딩: `/reservations/[id]/chat?token=` 페이지, 입구 3곳(예약 완료·`/reservations` 예약 카드·메일 링크), 10초 폴링, 4개 언어 문구.
   - 점주 앱: 홈 블록, 예약 탭 배지, 대화 화면, 빠른 답장 시트, 푸시 탭 → 대화 화면 이동.
3. 정리: 연결 없는 옛 페이지 `app/[locale]/reservations/[id]/page.tsx`(목업) 삭제 또는 `/reservations`로 이동 — 새 `/chat` 하위 경로와 헷갈리지 않게.

## 10. 테스트 체크리스트 (서버)
- 토큰 틀림 → 404, 이메일 조회로는 대화 불가
- 그룹 예약 3행 중 어느 id로 와도 같은 대화방
- 같은 언어 → `skipped`, 빠른 답장 → 상수 문장·API 미호출, 번역 타임아웃 → `failed` + 원문 전달
- 1,000자 초과 400, 닫힌 대화방 409(취소·no_show·찾고 24시간 뒤), 10분 21번째 429
- 영업시간 밖 손님 메시지 → 즉시 푸시 없음 → 영업 시작 후 크론에서 1회
- 점주 3분 안에 2개 → 메일 1통 / 손님이 그 사이 열어 봄 → 메일 0통
- 손님 응답에 전화번호·이메일 필드 없음
