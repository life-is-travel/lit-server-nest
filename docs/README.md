# PRD — lit-server-nest (Life Is Travel 짐 보관 예약 플랫폼 백엔드)

> 문서 유형: **현행(as-is) 구현 PRD** · 독자: 개발팀/QA(기술 명세 + 회귀 검증 기준)
> 기준 코드: branch `feat/multi-type-reservation` (커밋 `e05d32e`)
> 관점: 이미 구현된 동작을 기준으로 작성한다. **Must = 구현 완료 기능**, **수용 기준 = 현재
> 실제 동작(QA 회귀 테스트 기준)**, **이번 버전 제외 범위 = DB·스키마만 존재하고 로직이 없는 영역**.
> 성공 지표의 목표 수치는 `(제안/TBD)`로 표기 — 코드에 없는 제안값임을 의미한다.

`lit-server-nest`는 Express 기반 레거시에서 NestJS로 이관 중인 **여행객 대상 짐 보관(수하물 보관)
예약 SaaS**의 백엔드 API다. 예약·매장·보관함·쿠폰·대시보드 도메인이 동작하며, 결제·알림톡·정산은
DB 스키마만 존재한다. 이 PRD는 현재 구현을 정확히 문서화하여 온보딩·QA·로드맵의 공통 기준을 제공한다.

---

## 1. 프로덕트 개요 (목표, 성공 지표)

### 1.1 한 줄 정의
점주(보관소 운영자)가 짐 보관 슬롯을 등록·운영하고, 고객/비회원이 시간/타입 단위로 짐 보관을
예약·결제·수령하는 **멀티테넌트 예약 플랫폼**.

### 1.2 목표 / 핵심 가치
- **진입 장벽 최소화**: 비회원도 전화번호만으로 예약·조회·취소 가능.
- **멀티타입 동시 예약**: 한 번에 여러 보관 타입(소/중/대 등)을 한 요청으로 예약.
- **점주 실시간 운영**: 예약 승인·체크인·대시보드로 매장 운영을 한 화면에서 처리.
- **클라이언트 호환**: 웹(점주 콘솔) + Flutter 모바일 앱(레거시 snake_case 필드 호환 유지).

### 1.3 사용자(액터)

| 액터 | 인증 | 핵심 권한 |
|------|------|-----------|
| **점주(Store)** | JWT(이메일+비밀번호, 이메일 인증코드) | 매장/보관함/설정/PIN, 예약 승인·거절·체크인, 쿠폰 정책, 대시보드 |
| **로그인 고객(Customer)** | JWT(소셜: kakao 구현, naver/apple 스키마만) | 예약 생성·조회·체크아웃, 쿠폰 신청·사용, 프로필/알림 설정 |
| **비회원(Guest)** | 무인증 + 전화번호/토큰 검증, Throttle | 예약 생성·조회·취소, 쿠폰 조회·사용 |
| **관리자(Admin)** | `X-Admin-Token`(`ADMIN_FEEDBACK_TOKEN`) | 피드백 조회·응답(현재 피드백 도메인 한정) |

### 1.4 성공 지표 (제안)

> 아래 목표값은 모두 제안/TBD이며, 사업팀과 합의 후 확정한다. 측정 출처가 `daily_statistics`인 항목은
> 실제 집계 테이블로 산출 가능하고, 그 외는 별도 계측이 필요하다.

| 지표 | 정의 | 목표값(제안/TBD) | 측정 출처 |
|------|------|------------------|-----------|
| 비회원→예약 완료 전환율 | 예약 생성 시도 대비 결제·확정 완료 비율 | ≥ 60% (TBD) | 예약 로그/`reservations` |
| 예약 완료율 | `completed` / 전체 생성 예약 | ≥ 85% (TBD) | `reservations.status`, `daily_statistics` |
| 평균 점주 승인 소요시간 | `pending`→`confirmed` 평균 경과시간 | ≤ 10분 (TBD) | `reservations` 타임스탬프 |
| 매장당 일 예약 수 | 활성 매장 1곳의 일 평균 예약 건수 | ≥ 5건 (TBD) | `daily_statistics` |
| 보관함 점유율 | 활성 보관함 대비 사용 중 비율 | ≥ 40% (TBD) | `daily_statistics`(점유율) |
| 멀티타입 예약 비중 | 2개 이상 타입 그룹 예약 / 전체 예약 그룹 | ≥ 15% (TBD) | `reservation_group_id` 집계 |
| 예약 취소율 | `cancelled`+`rejected` / 전체 생성 | ≤ 10% (TBD) | `reservations.status`, `daily_statistics` |

---

## 2. 기능 목록 (MoSCoW)

ID는 `F-001`부터 부여. 아래 기능은 모두 **구현 완료** 상태다(미구현 로드맵은 §5 참조).
MoSCoW 우선순위는 제품 핵심성을 기준으로 한 분류다.

| ID | 기능명 | 도메인 / 경로 | MoSCoW | 상태 |
|----|--------|---------------|--------|------|
| F-001 | 점주 인증 | `api/auth` | Must | 구현완료 |
| F-002 | 고객 소셜 인증 | `api/customer/auth` | Must | 구현완료 |
| F-003 | 매장 프로필·영업상태·설정·PIN | `api/store` | Must | 구현완료 |
| F-004 | 보관함 관리 | `api/storages` | Must | 구현완료 |
| F-005 | 고객용 매장 조회·검색 | `api/customer/stores` | Must | 구현완료 |
| F-006 | 비회원 예약 | `api/guest/reservations` | Must | 구현완료 |
| F-007 | 고객 예약 | `api/customer/reservations` | Must | 구현완료 |
| F-008 | 점주 예약 운영(승인/거절/체크인/상태) | `api/reservations` | Must | 구현완료 |
| F-009 | 멀티타입 예약(그룹 분리 + `reservation_group_id`) | 예약 전 도메인 | Must | 구현완료(최신 `e05d32e`) |
| F-010 | 예약 가격 계산(누진·06:00 KST 경계) | `reservation-pricing` | Must | 구현완료 |
| F-011 | 쿠폰 정책·발급·사용 | `*/coupons` | Should | 구현완료 |
| F-012 | 운영 대시보드 | `api/dashboard` | Should | 구현완료 |
| F-013 | 주소 검색/지오코딩 | `api/addresses` | Should | 구현완료 |
| F-014 | 피드백 | `*/feedbacks` | Could | 구현완료 |
| F-015 | 헬스체크 | `health` | Could | 구현완료 |
| F-016 | QR 토큰 기반 체크인/체크아웃 | `api/reservations` | Must | 구현완료(비활성) |
| F-017 | 점주 FCM 푸시 토큰 등록 + 새 리뷰 푸시 | `api/store/push-tokens`, `notifications` | Should | 구현완료 |

---

## 3. 기능별 유저 스토리 + 수용 기준

> 수용 기준은 모두 `✅` 형식의 QA 검증 문장이다. 각 문장은 통과/실패를 단독으로 판정할 수 있어야 한다.

### F-001 점주 인증 (`api/auth`)
**유저 스토리**: 점주로서 매장을 운영하기 위해 이메일로 가입·로그인하고 토큰을 발급받는다.

- ✅ 인증코드 발송 요청은 1분에 1회로 제한된다(초과 시 거절).
- ✅ 인증코드는 6자리, 유효기간 180초이며 최대 5회 검증 시도 후 만료된다.
- ✅ 이메일 인증을 통과해야만 `register`로 점주 계정을 생성할 수 있다.
- ✅ 로그인 성공 시 access 토큰(1시간)과 refresh 토큰(30일)을 발급한다.
- ✅ 점주 토큰 페이로드는 `{ storeId, email, type }`를 포함한다.
- ✅ 인증 API는 15분 동안 5회를 초과하면 레이트리밋으로 차단된다(`AUTH_RATE_LIMIT_*`).
- ✅ 비밀번호는 평문이 아닌 bcryptjs 해시로 저장된다.
- ✅ 인증된 점주는 `PATCH /api/auth/password`로 현재 비밀번호를 확인받은 뒤 새 비밀번호(최소 8자)로 변경할 수 있다. 현재 비밀번호가 일치하지 않으면 거절된다.
- ✅ 비밀번호 변경에 성공하면 해당 점주의 기존 refresh 토큰(세션)은 모두 무효화된다.
- ✅ 로그인(`login`)에 성공하면 매장의 `last_login_at`이 현재 시각으로 갱신되고, 실패 카운트(`login_count`)와 잠금(`login_locked_until`)이 초기화된다.
- ✅ 로그인 비밀번호를 5회 연속 틀리면 계정이 10분간 잠기고(`login_count`/`login_locked_until`), 잠금 해제 시각 전까지는 비밀번호가 맞아도 로그인이 거부된다(PIN 잠금과 동일 정책).

### F-002 고객 소셜 인증 (`api/customer/auth`)
**유저 스토리**: 고객으로서 빠르게 시작하기 위해 카카오 소셜 로그인으로 가입·로그인한다.

- ✅ `social-login` 시 kakao 토큰을 검증하고, 최초 로그인이면 계정을 자동 생성한다.
- ✅ 탈퇴한 사용자가 동일 소셜로 재로그인하면 재가입이 가능하다.
- ✅ `signup`으로 추가 정보를 입력하면 프로필에 반영된다.
- ✅ 고객 토큰 페이로드는 `{ customerId, role: 'customer', provider?, type }`를 포함한다.
- ✅ `me` 조회·수정, `notification-settings` 조회·수정이 인증 고객에 한해 동작한다.
- ✅ `withdraw` 호출 시 계정이 탈퇴 처리된다.
- ✅ 소셜 로그인 API는 분당 10회를 초과하면 차단된다.
- ✅ naver/apple은 스키마만 존재하며 실제 로그인은 동작하지 않는다.

### F-003 매장 프로필·영업상태·설정·PIN (`api/store`, 점주)
**유저 스토리**: 점주로서 매장을 노출·운영하기 위해 프로필·영업상태·요금/수용량 설정·PIN을 관리한다.

- ✅ 프로필 조회/수정, 영업 상태(open/close/status) 조회/수정이 동작한다.
- ✅ 설정(`settings`)에 보관함 타입별 요금/수용량/활성화 플래그와 알림 on/off 플래그가 포함된다.
- ✅ 전화번호는 `phone_number`(점주 개인) / `store_phone_number`(고객 노출) / `notification_phone`(알림톡 수신) 3종으로 분리 저장된다.
- ✅ 고객 노출 API에는 `store_phone_number`만 노출되며 점주 개인 `phone_number`는 노출되지 않는다.
- ✅ PIN 설정·검증이 동작하고, PIN 검증은 분당 5회로 제한된다.
- ✅ PIN 검증을 5회 연속 실패하면 잠금되고(`store_pin_failed_count`/`store_pin_locked_until`), 잠금 해제 시각까지 검증이 거부된다.

### F-004 보관함 관리 (`api/storages`, 점주)
**유저 스토리**: 점주로서 재고를 관리하기 위해 보관함을 등록·조회·수정·폐기한다.

- ✅ 목록은 `type`/`status` 필터로 조회된다.
- ✅ 보관함 타입은 `s/m/l/xl/special/refrigeration` 중 하나만 허용된다.
- ✅ 보관함 상태는 `available/occupied/maintenance` 중 하나다.
- ✅ `(store_id, number)` 조합은 유니크하며 중복 등록 시 거부된다.
- ✅ 삭제 요청은 물리 삭제가 아니라 `maintenance` 상태 전환으로 처리된다.

### F-005 고객용 매장 조회·검색 (`api/customer/stores`)
**유저 스토리**: 고객으로서 근처 보관소를 찾기 위해 키워드/위치로 매장을 검색하고 상세를 본다.

- ✅ 목록은 키워드 검색과 위치 검색(`lat`/`lng`/`range`)을 지원한다.
- ✅ 노출 필드는 고객 안전 정보로 축약되며 `store_phone_number`만 포함하고 점주 `phone_number`는 포함하지 않는다.
- ✅ 상세 조회가 동작한다.

### F-006 비회원 예약 (`api/guest/reservations`)
**유저 스토리**: 비회원으로서 가입 없이 예약하기 위해 전화번호로 예약을 생성·조회·취소한다.

- ✅ 예약 생성은 단일 타입과 멀티타입(F-009) 입력을 모두 지원한다.
- ✅ 예약 생성 시 그룹의 각 타입 행은 즉시 자동 승인되어 `confirmed`로 전환되고 보관함이 할당된다. 특정 타입에 가용 보관함이 없으면 해당 행만 `pending`으로 남는다.
- ✅ `availability`는 시간대별·타입별 가용 수량을 반환한다.
- ✅ 목록은 `?phoneNumber=`로, 상세는 `?token=`(접근 토큰)으로 조회된다.
- ✅ `/:id/cancel` 취소는 전화번호 검증을 통과해야 동작한다.
- ✅ `cleanup`은 미결제 상태로 30분(TTL) 경과한 비회원 예약을 정리한다. 자동 승인되어 `confirmed`가 된 미결제 예약도 대상이며, 취소 시 점유 중이던 보관함을 반납한다.
- ✅ 비회원 예약 API는 기본 분당 10회, cleanup 3회, availability/상세 30회로 제한된다.

### F-007 고객 예약 (`api/customer/reservations`)
**유저 스토리**: 로그인 고객으로서 내 예약을 관리하기 위해 예약을 생성·조회·체크아웃한다.

- ✅ 예약 생성, 목록(페이지네이션), 상세 조회가 인증 고객에 한해 동작한다.
- ✅ 예약 생성 시 별도 점주 승인 없이 즉시 자동 승인되어 `confirmed`로 생성되고 보관함이 할당된다. 단, 해당 시간대에 가용 보관함이 없으면 예약은 `pending`으로 남고 생성 자체는 성공한다(이후 점주가 수동 `/approve` 가능).
- ✅ `/:id/checkout`으로 짐 수령(체크아웃) 처리를 한다.
- ✅ 각 예약 행에는 `groupId`가 포함된다(멀티타입은 N건 개별 노출).

### F-008 점주 예약 운영 (`api/reservations`, 점주)
**유저 스토리**: 점주로서 예약을 처리하기 위해 승인·거절·취소·상태변경·체크인을 한다.

- ✅ 목록은 `status`/`date` 필터로 조회된다.
- ✅ 점주가 생성한 예약(`POST /api/reservations`)은 생성 즉시 자동 승인되어 `confirmed`로 생성되고 보관함이 할당된다. 가용 보관함이 없으면 `pending`으로 남고 생성은 성공한다.
- ✅ `/approve` 승인 시 보관함이 할당된다. 자동 승인되지 못하고 `pending`으로 남은 예약을 점주가 수동 승인하는 용도로도 사용된다.
- ✅ `/reject` 거절, `/cancel` 취소, `/status` 상태 수정이 동작한다.
- ✅ `/checkin` 체크인 시 짐 사진 업로드가 가능하다.
- ✅ 예약 상태는 `pending → confirmed → in_progress → completed`로 전이하며, 분기 상태는 `rejected`(점주 거절)·`cancelled`(취소)다.
- ✅ 결제 상태는 `pending / paid / refunded` 중 하나다.
- ✅ `pending_approval` 상태는 호환용으로만 존재하며 실제 흐름에서 사용되지 않는다.

### F-009 멀티타입 예약 (그룹 분리 + `reservation_group_id`)
**유저 스토리**: 손님으로서 한 번에 여러 보관 타입을 맡기기 위해 한 요청으로 여러 타입을 예약한다.

- ✅ 입력은 단일(`storageType`+`bagCount`) 또는 멀티(`items: [{ storageType, bagCount }]`)를 지원하며, `items` 제공 시 단일 필드는 무시된다.
- ✅ 멀티타입 요청 시 타입별로 `reservations` 행이 분리 생성되고 동일 `reservation_group_id`로 묶인다.
- ✅ 대표 예약은 `id === reservation_group_id`이며, 멤버 예약의 `reservation_group_id`는 대표를 가리킨다.
- ✅ 기존 `reservation_group_id`가 NULL인 행은 자기 자신이 대표인 1건 그룹으로 간주된다.
- ✅ 한 타입이라도 수용량이 부족하면 전체 예약이 CONFLICT로 실패한다(부분 생성 없음, 원자성).
- ✅ 결제는 그룹당 1건이며 대표 예약에만 `payment_id`가 연결되고 멤버는 NULL이다.
- ✅ 비회원 목록·상세는 그룹을 1건으로 머지하여 `groupId`, 합산 `totalAmount`/`bagCount`, `items[]`로 노출한다.
- ✅ 점주·고객 API는 그룹 멤버를 N건 개별 노출하되 각 행에 `groupId`를 포함한다.
- ✅ 접근 토큰(`qr_code`)과 생성 알림 이메일은 그룹이 공유한다.
- ✅ 취소는 그룹 전체 일괄 취소만 허용되며(부분 취소 불가) 응답에 `cancelledCount`를 반환한다.

### F-010 예약 가격 계산 (`reservation-pricing.service`)
**유저 스토리**: 시스템으로서 정확히 과금하기 위해 누진 모델로 타입별 금액을 합산한다.

- ✅ 가격은 일수 기반 누진 모델로 KST 기준 계산된다.
- ✅ 과금 기준일 경계는 자정이 아니라 오전 06:00 KST이며, 심야 마감 매장이 자정을 넘겨도 같은 영업일 요금으로 계산된다.
- ✅ 멀티타입 예약의 총액은 각 타입 금액의 합산이다.

### F-011 쿠폰 정책·발급·사용 (`api/store/coupons/policies`, `api/customer/coupons`, `api/guest/coupons`)
**유저 스토리**: 점주로서 재방문을 유도하기 위해 쿠폰 정책을 만들고, 고객/비회원이 쿠폰을 신청·사용한다.

- ✅ 정책 유형은 `payment_discount`(결제 할인)와 `store_benefit`(매장 특전)을 지원한다.
- ✅ 자동 발급 트리거는 `manual_claim`/`signup`/`checkin_completed`를 지원한다.
- ✅ 쿠폰 유효기간 기본값은 7일이다.
- ✅ 점주는 정책 CRUD를 수행한다.
- ✅ 고객은 신청(`claim`), 목록/통계/상세, 사용(`redeem`, storePin 필요)과 Express 호환 `use`를 수행한다.
- ✅ 비회원은 전화번호 기반으로 쿠폰을 조회·사용한다.

### F-012 운영 대시보드 (`api/dashboard`, 점주)
**유저 스토리**: 점주로서 운영 현황을 파악하기 위해 요약·기간 통계·실시간 수치를 본다.

- ✅ `summary`(Express 호환), `stats`(기간 `from/to`), `realtime`(오늘 수치)가 조회된다.
- ✅ 집계 소스는 `daily_statistics`(매출·예약수·완료/취소수·평균기간·점유율)다.

### F-013 주소 검색/지오코딩 (`api/addresses`)
**유저 스토리**: 사용자로서 매장 위치를 입력하기 위해 주소를 검색하고 좌표를 얻는다.

- ✅ VWorld API(`VWORLD_API_KEY`) 기반으로 주소 검색/지오코딩이 동작한다.

### F-014 피드백 (`api/feedbacks`, `api/customer/feedbacks`, `api/admin/feedbacks`)
**유저 스토리**: 사용자로서 의견을 전달하고, 관리자로서 피드백에 응답한다.

- ✅ 카테고리는 `feature/issue/praise/other`, 상태는 `reviewing/inProgress/shipped/rejected`다.
- ✅ 익명 IP는 `FEEDBACK_IP_HASH_SECRET`로 해시되어 저장된다(평문 미저장).
- ✅ 관리자는 `X-Admin-Token` 헤더로만 피드백 조회·응답이 가능하다.

### F-015 헬스체크 (`health`)
**유저 스토리**: 운영자로서 서비스 가용성을 확인하기 위해 헬스 엔드포인트를 호출한다.

- ✅ `GET /health`는 DB 연결 상태를 포함한 점검 결과를 반환한다.

### F-016 QR 토큰 기반 체크인/체크아웃 (`api/reservations`, 점주)
**유저 스토리**: 점주로서 고객의 QR 코드를 스캔하여 빠르게 체크인·체크아웃을 처리한다.

> ⚠️ **현재 비활성**: 매장 앱(lit-store) 미배포로 컨트롤러 엔드포인트가 주석 처리되어 있음. 앱 배포 시 주석 해제로 즉시 활성화 가능.

- ✅ QR 이미지는 앱 프론트엔드에서 생성하며, 예약의 `qr_code` 필드값(토큰)을 인코딩한다.
- ✅ `POST /checkin-by-token` — 토큰으로 예약 조회 후 `in_progress`로 전이한다. 짐 사진(`photoUrls[]`)을 함께 업로드할 수 있다.
- ✅ 체크인 성공 시 `checkin_completed` 트리거 쿠폰 자동 발급이 실행되며, 발급 실패는 체크인을 롤백하지 않는다.
- ✅ `POST /checkout-by-token` — 토큰으로 예약 조회 후 `completed`로 전이하고 보관함을 해제한다.
- ✅ 체크아웃 응답에는 고객의 미사용 쿠폰 존재 여부(`hasUnusedCoupon`)가 포함된다.
- ✅ 토큰 미제공 → 401, 해당 매장에서 예약 미발견 → 404.

### F-017 점주 FCM 푸시 토큰 등록 + 새 리뷰 푸시 (`api/store/push-tokens`, `notifications`)
**유저 스토리**: 점주로서 lit-store 앱에 새 리뷰가 도착하면 즉시 푸시 알림을 받는다.

- ✅ `POST /api/store/push-tokens` (StoreAuthGuard) — body `{ token, platform('ios'|'android') }`를 토큰(unique) 기준으로 upsert한다. 이미 등록된 토큰이면 `store_id`/`platform`을 갱신한다(기기 재로그인·계정 전환 대응). 201 반환.
- ✅ `DELETE /api/store/push-tokens` — body `{ token }`. 소유 매장과 무관하게 토큰 일치 시 삭제한다(로그아웃 청소). 200 반환.
- ✅ 비회원 리뷰 저장 성공 직후, Discord 알림과 **병렬로**(fire-and-forget) 해당 매장의 등록 토큰 전체에 FCM 멀티캐스트 푸시를 보낸다. 어떤 알림 실패도 고객 리뷰 응답에 전파되지 않는다.
- ✅ 푸시 notification 제목은 `새 리뷰가 도착했어요 ⭐{rating}`, 본문은 `{작성자}: {코멘트 앞 40자}`(코멘트 없으면 `{작성자}님이 별점 {rating}점을 남겼어요`), data 페이로드는 `{ type: 'review_created', reviewId, storeId }`(전부 string)다.
- ✅ `FIREBASE_SERVICE_ACCOUNT_JSON`(서비스 계정 JSON 또는 base64) 미설정 시 FCM은 조용히 스킵된다(서버 기동·리뷰 생성에 영향 없음).
- ✅ 발송 응답에서 만료·무효 토큰(`registration-token-not-registered`, `invalid-registration-token`)은 DB에서 삭제(청소)된다.
- ✅ 리뷰 Discord 웹훅은 `DISCORD_REVIEW_WEBHOOK_URL` 우선, 없으면 `DISCORD_RESERVATION_WEBHOOK_URL`로 폴백한다.

---

## 4. 비기능 요구사항 (NFR)

### 4.1 응답 포맷 (ApiResponseInterceptor)
- ✅ 성공 응답은 `{ success: true, data: {...}, timestamp }` 형태다.
- ✅ 실패 응답은 `{ success: false, error: { code, message, details }, timestamp }` 형태다.

### 4.2 입력 검증
- ✅ 모든 입력 DTO는 class-validator로 검증되며, `whitelist + forbidNonWhitelisted`로 미정의 필드는 거부된다.
- ✅ `transform`(암묵 변환)과 커스텀 `createValidationException`이 적용된다.

### 4.3 레이트리밋 (@nestjs/throttler)

| 대상 | 제한 |
|------|------|
| 점주 인증 API | 15분 / 5회 (`AUTH_RATE_LIMIT_*`) |
| 비회원 예약(기본) | 10 req/min |
| 비회원 예약 cleanup | 3 req/min |
| 비회원 availability/상세 | 30 req/min |
| PIN 검증 | 5 req/min |
| 소셜 로그인 | 10 req/min |

### 4.4 보안
- ✅ 비밀번호는 bcryptjs 해시로 저장된다.
- ✅ JWT는 Access 1시간 / Refresh 30일 만료다.
- ✅ 피드백 IP는 `FEEDBACK_IP_HASH_SECRET`로 해시 저장된다.

### 4.5 로깅
- ✅ pino 구조화 로그(`LOG_LEVEL`)로 주요 도메인 이벤트를 기록한다.

### 4.6 레거시 호환
- ✅ Flutter/Express 호환을 위해 일부 snake_case·옵션 필드를 유지한다(`common/transformers`).

### 4.7 스택 / 런타임 / 운영
- ✅ 스택: NestJS 11 · TypeScript 5.7 · Prisma 7(MariaDB/MySQL 어댑터) · JWT · class-validator/Joi · Swagger · nestjs-pino · @nestjs/throttler · nodemailer · bcryptjs, Node 22.
- ✅ 계층: Controller(라우팅/검증) → Service(Query/Command 분리) → PrismaService(전역) → MySQL.
- ✅ 전역 prefix는 없으며 경로 prefix(`api/...`)는 각 컨트롤러 데코레이터에서 직접 선언한다.
- ✅ CORS(`CORS_ORIGIN`, credentials), Swagger(`SWAGGER_ENABLED`), 기본 포트 4000.
- ✅ 모듈 11개(`src/app.module.ts`): addresses, auth, customer-auth, customer-stores, coupons, dashboard, feedbacks, health, stores, storages, reservations.
- ✅ DB 마이그레이션은 `prisma db pull` 기반(마이그레이션 디렉토리 없음)이며, 스키마 변경은 DB 우선 → pull 동기화로 진행한다. 프로덕션 변경 시 영향도/롤백 계획을 필수로 한다.

---

## 5. 이번 버전 제외 범위 (Won't this version)

아래는 DB·스키마(또는 일부 DTO)가 존재하지만 **로직이 구현되지 않은 영역**으로, 이번 버전에서 제외한다.

| 제외 항목 | 사유 / 현재 상태 | 관련 테이블·자원 |
|-----------|------------------|------------------|
| 결제(PG/Toss) 연동 | 스키마만 존재, 로직 없음. (예약 생성→결제링크→웹훅→`payment_status=paid` 흐름 미구현) | `payments`, `payment_webhooks` |
| 알림톡/SMS 발송 | 설정 플래그·수신번호만 존재, 발송 로직 없음 | `notifications`, `stores.notification_phone` |
| 정산(Settlement) | 스키마만 존재(수수료 기본 0.2), 생성·지급 로직 없음 | `settlement_statements`, `store_settlement_accounts`, `settlement_items/logs/errors` |
| 웹푸시 리마인더 | 구독 스키마만 존재, 발송 로직 없음 | `push_subscriptions.sent_reminder_at` |
| 리뷰·고객센터 노출 | 스키마만 존재, 노출/응답 로직 없음 | `reviews`, `support_tickets/messages` |
| 관리자 콘솔 확장 | 현재 관리자 기능은 피드백 도메인에 한정 | (운영 기능 전반) |
| Naver/Apple 소셜 로그인 | enum/스키마만 존재, 검증 로직 없음(kakao만 구현) | `customer_auth_providers` |

---

## 부록: PRD 정확성 검증 방법

이 PRD는 코드 기반 현행 문서이므로 다음으로 정확성을 검증한다.

- **엔드포인트**: 각 `src/modules/**/*.controller.ts`의 `@Controller`/메서드 데코레이터와 §2~§3 경로 대조.
- **데이터 모델·enum**: `prisma/schema.prisma`의 enum/필드와 본문 규칙 대조.
- **동작 규칙**: 멀티타입은 `reservations/services/guest-reservation.service.ts`·`mappers/guest-reservation.mapper.ts`, 가격은 `reservations/pricing/reservation-pricing.service.ts`로 교차 확인.
- **빌드/실행**: `npm run build`, `npm run start:dev`, Swagger(`/docs`)로 실제 노출 스펙 대조. `npm test`로 도메인 규칙 회귀 확인.
