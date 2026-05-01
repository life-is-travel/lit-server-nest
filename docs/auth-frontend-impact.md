# Auth 변경 시 프론트 영향 사항

이 문서는 Auth 모듈에서 프론트 계약에 영향을 줄 수 있는 변경 후보를 기록합니다.
현재 브랜치에서는 아래 항목을 코드에 바로 반영하지 않고 문서화만 합니다.

## Refresh Token Rotation

현재 동작은 기존 Express 서버와 동일하게 유지합니다.

- `POST /api/auth/refresh` 요청 시 기존 `refreshToken`은 유지합니다.
- 응답은 새 `access token`만 반환합니다.

```json
{
  "success": true,
  "data": {
    "token": "new-access-token",
    "expiresIn": 3600
  },
  "timestamp": "2026-04-26T00:00:00.000Z"
}
```

운영 보안을 더 강화하려면 refresh token rotation을 적용할 수 있습니다.
그 경우 프론트는 `/refresh` 응답으로 새 `refreshToken`도 받아 저장해야 합니다.

예상 변경 응답:

```json
{
  "success": true,
  "data": {
    "token": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 3600
  },
  "timestamp": "2026-04-26T00:00:00.000Z"
}
```

프론트 필요 작업:

- 기존 refresh token을 새 refresh token으로 교체 저장
- 동시에 여러 `/refresh` 요청이 발생하지 않도록 잠금 처리
- rotation 실패 시 재로그인 처리

## Rate Limit 에러 처리

Auth API에 rate limit이 적용되면 429 응답이 발생할 수 있습니다.
프론트는 아래 에러 코드를 공통 에러 처리에 포함해야 합니다.

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.",
    "details": {
      "retryAfter": 60
    }
  },
  "timestamp": "2026-04-26T00:00:00.000Z"
}
```

프론트 필요 작업:

- 429 응답 시 재시도 안내 문구 노출
- 이메일 인증 코드 재발송 버튼을 일정 시간 비활성화
- 로그인 실패 반복 시 사용자에게 잠시 후 재시도 안내

## Storages 모듈 이전 영향

Storages API는 기존 경로를 유지합니다.

```txt
GET    /api/storages
GET    /api/storages/:id
PUT    /api/storages/:id
DELETE /api/storages/:id
```

프론트 요청/응답 구조는 기존 Express 서버와 최대한 호환되게 유지했습니다.
다만 운영 안전성을 위해 아래 정책이 강화되었습니다.

### 보관함 생성 경로 변경

`POST /api/storages`는 제공하지 않습니다.
보관함은 매장이 직접 개별 생성하지 않고 `PUT /api/store/settings`의 `storageSettings` 저장 흐름에서 자동 동기화됩니다.

프론트 필요 작업:

- 보관함 개수/타입 증감 UI는 `PUT /api/store/settings`를 호출
- 개별 보관함 생성 버튼이나 `POST /api/storages` 호출 제거
- 개별 보관함 화면에서는 위치, 크기, 가격, 상태 보정만 `PUT /api/storages/:id`로 처리

### DELETE 동작 변경

`DELETE /api/storages/:id`는 더 이상 DB에서 보관함을 물리 삭제하지 않습니다.
예약/리뷰/통계 이력을 보존하기 위해 `status = maintenance`로 전환합니다.

응답 예시:

```json
{
  "success": true,
  "data": {
    "id": "storage_1",
    "deleted": false,
    "status": "maintenance"
  },
  "timestamp": "2026-04-26T00:00:00.000Z"
}
```

프론트 필요 작업:

- 삭제 성공 후 목록에서 해당 보관함을 제거하거나 `maintenance` 상태로 표시
- `deleted: false`는 실패가 아니라 "물리 삭제하지 않음"을 의미하도록 처리

### 상태 변경 제한

`PUT /api/storages/:id`에서 `status = occupied`로 직접 변경할 수 없습니다.
`occupied` 상태는 예약 승인/체크인 흐름에서만 변경되어야 합니다.

진행 중인 예약(`confirmed`, `in_progress`)이 연결된 보관함은 아래 필드를 변경할 수 없습니다.

- `number`
- `type`
- `status`

프론트 필요 작업:

- 위 정책 위반 시 `STORAGE_IN_USE` 또는 `STORAGE_STATUS_MANAGED_BY_RESERVATION` 에러를 사용자에게 안내
- 사용 중인 보관함의 번호/타입/상태 변경 UI는 비활성화 권장

### 페이지네이션 제한

`GET /api/storages`의 `limit`은 최대 100으로 제한됩니다.

프론트 필요 작업:

- 한 번에 전체를 가져오는 방식 대신 페이지네이션 유지
- 큰 목록이 필요하면 `page`, `limit`으로 순차 조회

## Dashboard 모듈 Express 호환 변경

Dashboard API는 기존 Express 서버와 호환되도록 아래 3개 엔드포인트만 제공합니다.

```txt
GET /api/dashboard/summary
GET /api/dashboard/stats?period=daily|weekly|monthly|yearly
GET /api/dashboard/realtime
```

기존 NestJS 초안에 있던 아래 분석용 엔드포인트는 제거했습니다.

```txt
GET /api/dashboard/revenue
GET /api/dashboard/reservations
GET /api/dashboard/storages
```

프론트 필요 작업:

- 대시보드 화면은 기존 Express 호환 엔드포인트 3개만 호출
- `/api/dashboard/revenue`, `/api/dashboard/reservations`, `/api/dashboard/storages` 호출 제거
- `/summary` 응답은 기존처럼 flat 구조로 처리
- `/stats`는 `period` query를 `daily`, `weekly`, `monthly`, `yearly` 중 하나로 전달

운영 보정 사항:

- 기존 Express의 `active`, `approved` 예약 상태는 현재 DB enum에 없으므로 `confirmed`, `in_progress`를 활성 예약으로 집계합니다.
- 날짜 범위는 KST 기준으로 계산합니다.
- 매출은 기존 호환을 위해 `reservations.payment_status = paid`와 `reservations.total_amount` 기준으로 집계합니다.

## Reservations 모듈 1차 이전 영향

매장 관리자용 예약 API가 기존 Express 서버와 같은 경로로 추가되었습니다.
모든 엔드포인트는 매장 인증 토큰이 필요합니다.

```txt
POST /api/reservations
GET  /api/reservations
GET  /api/reservations/:id
PUT  /api/reservations/:id/approve
PUT  /api/reservations/:id/reject
PUT  /api/reservations/:id/cancel
PUT  /api/reservations/:id/status
PUT  /api/reservations/:id/checkin
```

프론트 요청/응답 구조는 기존 Express 서버와 최대한 호환되게 유지했습니다.

호환 유지 사항:

- 예약 목록 응답은 `items`, `page`, `limit`, `total` 구조를 유지합니다.
- 예약 응답 필드는 `storeId`, `customerId`, `customerName`, `phoneNumber`, `storageType`, `paymentStatus`처럼 camelCase로 반환됩니다.
- `PUT /api/reservations/:id/status`는 기존 Express 호환을 위해 `approved`를 `confirmed`, `active`를 `in_progress`로 변환합니다.

운영 보정 사항:

- 예약 승인, 취소, 거절, 체크인은 트랜잭션으로 처리합니다.
- 예약 승인 시 사용 가능한 보관함을 배정하고, 해당 보관함을 `occupied`로 변경합니다.
- 예약 취소/거절/완료 상태로 변경되면 연결된 보관함을 `available`로 반납합니다.
- 완료/취소/거절된 예약은 다른 상태로 다시 변경할 수 없습니다.
- 날짜 필터는 KST 기준 일자 범위로 처리합니다.

## Customer Reservations 모듈 이전 영향

로그인 고객용 예약 API가 기존 Express 서버와 같은 경로로 추가되었습니다.
모든 엔드포인트는 고객 access token이 필요합니다.

```txt
GET  /api/customer/reservations
GET  /api/customer/reservations/:id
POST /api/customer/reservations
PUT  /api/customer/reservations/:id/checkout
```

프론트 요청/응답 구조는 기존 Express 서버와 최대한 호환되게 유지했습니다.

호환 유지 사항:

- 예약 목록 응답은 `items`, `page`, `limit`, `total` 구조를 유지합니다.
- 예약 응답 필드는 `storeId`, `customerId`, `customerName`, `phoneNumber`, `storageType`, `paymentStatus`처럼 camelCase로 반환됩니다.
- 고객 예약 생성 요청은 기존처럼 `storeId`, `customerName`, `phoneNumber`, `startTime`, `duration`, `bagCount`, `storageType`이 필요합니다.

운영 보정 사항:

- 고객 예약 조회/상세/체크아웃은 항상 JWT의 `customerId` 기준으로 제한합니다.
- 요청 body의 `customerId`는 신뢰하지 않고, 인증 토큰의 `customerId`를 사용합니다.
- 체크아웃은 `confirmed`, `in_progress` 상태에서만 허용합니다.
- 체크아웃은 트랜잭션으로 처리하며 예약을 `completed`로 변경하고 연결된 보관함을 `available`로 반납합니다.
- 고객 토큰은 기존 Express와 동일하게 `{ customerId, role: 'customer', type: 'access' }` 형태를 검증합니다.

## Guest Reservations 모듈 이전 영향

비회원 예약 API가 기존 Express 서버와 같은 경로로 추가되었습니다.
비회원 API는 인증이 없으므로 rate limit이 적용됩니다.

```txt
POST /api/guest/reservations
POST /api/guest/reservations/cleanup
GET  /api/guest/reservations/availability
GET  /api/guest/reservations
GET  /api/guest/reservations/:id
PUT  /api/guest/reservations/:id/cancel
```

호환 유지 사항:

- 예약 생성 요청은 기존 Express 호환을 위해 `storageType`과 `requestedStorageType`을 모두 허용합니다.
- 이메일 필드는 `email`과 `customerEmail`을 모두 허용합니다.
- 결제 필드는 `paymentKey`/`orderId`와 `payment_key`/`order_id`를 모두 허용합니다.
- 전화번호 기반 목록 조회는 `phoneNumber`와 `customer_phone` query를 모두 허용합니다.
- 예약 상세 조회는 기존처럼 `token` query가 필요합니다.
- 예약 생성 응답은 `reservation`, `storeName` 구조를 유지합니다.

운영 보정 사항:

- 비회원 API에는 IP 기반 rate limit이 적용됩니다.
- 전화번호는 하이픈/공백 제거 후 저장 및 비교합니다.
- 예약 생성 시 매장 slug 또는 id를 받아 canonical store id로 정규화합니다.
- 예약 생성 시 capacity를 사전 검증하고, 트랜잭션 내부에서 다시 검증합니다.
- 결제 정보가 전달되면 성공 결제인지 확인하고, 이미 다른 예약에 연결된 결제는 거부합니다.
- 예약 생성과 결제 `reservation_id` 연결은 트랜잭션으로 처리합니다.
- 비회원 예약 취소는 전화번호 검증 후 가능하며, 이미 시작된 예약은 취소할 수 없습니다.
- 비회원 예약 취소 시 연결된 보관함이 있으면 `available`로 반납합니다.
- 미결제 guest pending 예약은 cleanup API에서 30분 TTL 기준으로 `cancelled` 처리합니다.

## Customer Auth 모듈 이전 영향

고객 인증 API가 기존 Express 서버와 같은 경로로 추가되었습니다.

```txt
POST   /api/customer/auth/social-login
POST   /api/customer/auth/signup
POST   /api/customer/auth/refresh
POST   /api/customer/auth/logout
DELETE /api/customer/auth/withdraw
GET    /api/customer/auth/me
PATCH  /api/customer/auth/me
GET    /api/customer/auth/notification-settings
PUT    /api/customer/auth/notification-settings
```

호환 유지 사항:

- 고객 access token payload는 기존처럼 `{ customerId, role: "customer", provider, type: "access" }` 구조를 사용합니다.
- 고객 refresh token payload는 `{ customerId, role: "customer", provider, type: "refresh" }` 구조를 사용합니다.
- 소셜 로그인/가입 응답은 기존 Express의 `isNewUser`, `accessToken`, `refreshToken`, `providerRefreshToken`, `userId`, `customerId` 필드를 유지합니다.
- `POST /api/customer/auth/social-login`은 `accessToken`과 `socialAccessToken`을 모두 provider access token 입력으로 허용합니다.
- `POST /api/customer/auth/logout`은 기존처럼 refresh token이 없어도 성공 응답을 반환합니다.
- `GET /api/customer/auth/notification-settings`는 현재 스키마에 알림 설정 컬럼이 없으므로 기존 Express fallback과 같은 기본값을 반환합니다.
- `PUT /api/customer/auth/notification-settings`는 기존 Express와 동일하게 `DB_MIGRATION_NEEDED` 에러를 반환합니다.

운영 보정 사항:

- 소셜 로그인은 provider access token을 서버에서 검증합니다. 현재 구현은 Kakao 검증을 지원합니다.
- refresh token은 재발급 시 DB에 저장된 token을 새 token으로 교체하는 rotation 방식입니다.
- 탈퇴는 고객 row를 삭제하지 않고 개인정보를 익명화하며, refresh token과 소셜 연결 정보는 삭제합니다.
- 고객 보호 API는 JWT의 `customerId`만 신뢰하고 request body의 고객 식별자는 사용하지 않습니다.
- 소셜 로그인과 refresh API에는 rate limit을 적용했습니다. 서버를 여러 대로 확장할 때는 throttler storage를 Redis 같은 공유 저장소로 교체해야 합니다.

프론트 필요 작업:

- `/refresh` 응답의 새 `refreshToken`을 저장 중인 refresh token과 교체해야 합니다.
- 여러 화면에서 동시에 `/refresh`가 발생하지 않도록 refresh 요청 단일화가 필요합니다.
- Kakao 외 provider를 실제로 사용하려면 provider별 access token 검증 흐름이 추가된 뒤 활성화해야 합니다.

## Customer Stores 모듈 이전 영향

고객 앱용 매장 조회 API가 기존 Express 서버와 같은 경로로 추가되었습니다.

```txt
GET /api/customer/stores
GET /api/customer/stores/:storeId
```

호환 유지 사항:

- `GET /api/customer/stores`는 기존처럼 `{ items: [...] }` 구조를 반환합니다.
- 매장 식별자는 상세 조회에서 내부 `id`와 고객 공유용 `slug`를 모두 허용합니다.
- 매장 연락처는 `store_phone_number`를 우선 사용하고, 없으면 기존 데이터 호환을 위해 `phone_number`를 반환합니다.
- `reviews`, `operatingHours`, `settings`는 기존 Express처럼 camelCase로 변환해 반환합니다.

운영 보정 사항:

- `limit`은 최대 100으로 제한합니다.
- `keyword`는 최대 100자로 제한하고 매장명/주소에만 적용합니다.
- 목록 조회의 중첩 `reviews`는 매장별 최신 20개까지만 포함합니다. 전체 리뷰 목록이 필요하면 별도 리뷰 API로 분리하는 것이 맞습니다.
- 위도/경도 Decimal 값은 JSON 응답에서 number로 변환합니다.

프론트 필요 작업:

- 기존 목록/상세 조회 경로는 그대로 사용할 수 있습니다.
- 목록 화면에서 전체 리뷰가 필요하다면 향후 리뷰 전용 API 연동으로 분리해야 합니다.

## Coupons 모듈 이전 영향

쿠폰 API가 기존 Express 서버 경로를 유지하면서 새 쿠폰 정책 기준으로 이전되었습니다.

```txt
GET    /api/customer/coupons
GET    /api/customer/coupons/stats
GET    /api/customer/coupons/:id
POST   /api/customer/coupons/claim
POST   /api/customer/coupons/:id/redeem
POST   /api/customer/coupons/:id/use

POST   /api/store/coupons/policies
GET    /api/store/coupons/policies
GET    /api/store/coupons/policies/:id
PUT    /api/store/coupons/policies/:id
DELETE /api/store/coupons/policies/:id
```

호환 유지 사항:

- 고객 쿠폰 목록/상세/통계 경로는 기존 Express 경로를 유지합니다.
- 응답 필드는 `customerId`, `storeId`, `discountAmount`, `benefitItem`처럼 기존 camelCase를 유지합니다.
- 기존 `POST /api/customer/coupons/:id/use`는 유지하되, 새 정책에 맞게 `storePin`이 필수입니다.

동작 변경 사항:

- `POST /api/customer/coupons/claim`은 더 이상 고객이 쿠폰 내용을 직접 입력해 생성하지 않습니다.
- 고객은 `policyId`를 보내 `manual_claim`이고 `enabled = 1`인 정책 쿠폰만 발급받을 수 있습니다.
- `payment_discount` 쿠폰은 발급/조회만 지원하며 실제 결제 적용/사용 처리는 결제 모듈 도입 전까지 보류합니다.
- `store_benefit` 쿠폰은 고객 단독 사용 처리를 허용하지 않습니다.
- 매장 혜택 쿠폰 사용은 `storePin` 검증 후에만 `used` 처리됩니다.
- 체크인 자동 발급 서비스는 `customerId`가 있는 로그인 고객만 대상으로 합니다. 비회원 예약은 스킵합니다.

요청 예시:

```json
POST /api/customer/coupons/claim
{
  "policyId": "coup_pol_..."
}
```

```json
POST /api/customer/coupons/:id/redeem
{
  "storePin": "1234"
}
```

프론트 필요 작업:

- 쿠폰 받기 UI는 `type`, `discountAmount` 등을 직접 보내지 말고 `policyId`만 보내야 합니다.
- 매장 혜택 쿠폰 사용 화면에는 매장 직원이 입력할 4자리 PIN 입력 UI가 필요합니다.
- 결제 할인 쿠폰은 결제 화면에서 선택 후보로 표시할 수 있지만, 실제 금액 차감은 결제 모듈 도입 후 연결해야 합니다.
- 기존 `/use` 호출이 있다면 body에 `storePin`을 포함하거나 `/redeem`으로 전환해야 합니다.

## Guest Coupons 모듈 영향

비회원 전화번호 기반 쿠폰 자동 발급과 조회/사용 API가 추가되었습니다.

```txt
GET  /api/guest/coupons?phoneNumber={phoneNumber}&token={reservationToken}
GET  /api/guest/coupons/:id?phoneNumber={phoneNumber}&token={reservationToken}
POST /api/guest/coupons/:id/redeem
```

동작 기준:

- 매장 체크인 완료 시 로그인 고객은 `customerId` 기준, 비회원은 `phone_snapshot` 기준으로 쿠폰을 자동 발급합니다.
- 비회원 쿠폰 조회는 전화번호와 비회원 예약 조회 토큰을 함께 검증합니다.
- 비회원 쿠폰 사용은 전화번호, 예약 조회 토큰, 매장 PIN을 모두 검증합니다.
- 비회원 쿠폰의 내부 `customerId`는 `guest_phone_{normalizedPhone}` 형식으로 저장됩니다.
- `reservation_completed` 트리거는 계속 사용하지 않습니다.

비회원 쿠폰 사용 요청 예시:

```json
{
  "phoneNumber": "01012345678",
  "token": "guest-reservation-token",
  "storePin": "1234"
}
```

프론트 필요 작업:

- 비회원 예약 조회 화면에서 받은 예약 토큰을 쿠폰 조회/사용 요청에도 전달해야 합니다.
- 비회원 쿠폰함 화면은 전화번호와 예약 토큰이 있는 상태에서만 호출해야 합니다.
- 매장 혜택 쿠폰 사용 화면은 로그인 고객과 동일하게 매장 PIN 입력 UI가 필요합니다.

## Customer Stores 예약 카운트 응답 영향

고객용 매장 목록/상세 응답에 `reservationCount` 필드가 추가되었습니다.

```txt
GET /api/customer/stores
GET /api/customer/stores/:storeId
```

응답 예시:

```json
{
  "id": "store_f8374164-236b-4e33-984a-b1d5d48d1714",
  "slug": "bean-mamapapa",
  "businessName": "빈마마파파",
  "reservationCount": 12
}
```

동작 기준:

- `reservationCount`는 `cancelled`, `rejected` 상태를 제외한 예약 수입니다.
- 별도 카운트 조회 API는 추가하지 않습니다.
- 매장 목록과 매장 상세 조회 응답에서 동일하게 내려갑니다.
- 예약이 없으면 `0`으로 내려갑니다.

프론트 필요 작업:

- 랜딩/고객 매장 카드나 상세 모달에서 `reservationCount > 0`일 때만 예약 건수 pill을 노출할 수 있습니다.
- 기존 응답 필드는 제거되지 않았으므로 기존 화면은 그대로 동작합니다.
