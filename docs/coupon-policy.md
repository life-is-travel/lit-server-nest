# Coupon Policy

이 문서는 Lit 서비스의 쿠폰 정책과 NestJS coupon 모듈 구현 기준을 정의합니다.
기존 Express 서버의 쿠폰 코드는 참고하되, 그대로 이전하지 않고 아래 정책을 기준으로 구현합니다.

## 목표

- 결제 모듈 도입 전에도 매장 혜택 쿠폰을 운영 가능한 수준으로 제공한다.
- 결제 모듈 도입 후 서비스 결제 할인 쿠폰을 안전하게 확장할 수 있게 한다.
- 쿠폰 발급, 조회, 사용 처리를 고객/매장/시스템 권한으로 명확히 분리한다.
- 쿠폰 사용은 중복 사용, 만료 사용, 타 매장 사용을 막는 트랜잭션 기준으로 처리한다.

## 쿠폰 종류

현재 DB의 `coupons.type`, `coupon_policies.type`은 아래 의미로 사용한다.

| DB type | 서비스 의미 | 사용 위치 | 1차 구현 상태 |
| --- | --- | --- | --- |
| `payment_discount` | 서비스 결제 할인 쿠폰 | 플랫폼 결제 금액 할인 | 발급/조회 중심, 결제 적용은 보류 |
| `store_benefit` | 매장 혜택 쿠폰 | 매장 방문 시 품목/서비스 혜택 | 발급/조회/매장 PIN 사용 처리 |

### 서비스 결제 할인 쿠폰

우리 서비스 결제 금액에 적용되는 쿠폰이다.

예시:

- 1,000원 할인
- 10% 할인
- 최소 결제금액 10,000원 이상 2,000원 할인

정책:

- 고객이 결제 화면에서 직접 선택한다.
- 실제 사용 확정은 결제 성공 시점에 처리한다.
- 결제 실패 시 쿠폰은 사용 처리하지 않는다.
- 결제 취소/환불 시 쿠폰 복구 정책은 결제 모듈에서 함께 정의한다.

현재 결제 모듈은 사업자 등록 및 PG 계약 이후 개발 예정이므로, 1차 coupon 모듈에서는 결제 할인 쿠폰의 실제 결제 적용을 구현하지 않는다.

### 매장 혜택 쿠폰

매장에서 제공하는 품목 할인 또는 서비스 혜택 쿠폰이다.
플랫폼 결제 금액에는 직접 반영하지 않는다.

예시:

- 음료 1잔 제공
- 사이다 1개 제공
- 매장 메뉴 10% 할인
- 짐 보관 고객 대상 매장 품목 할인

정책:

- 고객은 쿠폰함에서 쿠폰을 제시한다.
- 매장 직원은 고객 앱 화면에 매장 PIN을 입력해 쿠폰 사용을 확인한다.
- 서버는 쿠폰과 PIN을 검증한 뒤 쿠폰을 `used`로 변경한다.
- 고객이 혼자 쿠폰을 사용 처리할 수 없어야 한다.

## 발급 주체

쿠폰 발급 주체는 세 가지로 분리한다.

### 시스템 자동 발급

이벤트 발생 시 서버가 자동으로 쿠폰을 발급한다.

현재 우선 적용 대상:

- `signup`: 고객 가입 완료 시 서비스 쿠폰 발급
- `checkin_completed`: 매장 체크인 완료 시 매장 혜택 쿠폰 발급

주의:

- `reservation_completed` 트리거는 사용하지 않는다.
- 결제 성공 기반 발급은 결제 모듈 도입 이후 별도 트리거로 검토한다.
- 비회원 예약은 `phone_snapshot` 기준으로 쿠폰을 자동 발급할 수 있다.
- 비회원 쿠폰 조회/사용은 전화번호와 예약 조회 토큰을 함께 검증한다.

### 매장 정책 기반 자동 발급

매장이 `coupon_policies`에 정책을 생성하면, 해당 조건이 충족될 때 자동 발급한다.

1차 권장 정책:

- `type = store_benefit`
- `store_id = 해당 매장 ID`
- `auto_issue_on = checkin_completed`
- `enabled = 1`

즉, 고객이 해당 매장에서 체크인 완료하면 매장 혜택 쿠폰이 자동 발급된다.

로그인 고객 예약은 `customer_id` 기준으로 쿠폰을 발급한다.
비회원 예약은 `phone_snapshot` 기준으로 쿠폰을 발급한다.

### 고객 수동 발급

고객이 직접 "쿠폰 받기"를 누르는 방식이다.

1차에서는 기존 DB의 `manual_claim` 정책을 유지하되, 남용 방지를 위해 정책 단위 중복 발급 제한을 함께 고려해야 한다.

## 사용 권한

| 쿠폰 유형 | 조회 권한 | 사용 처리 권한 | 비고 |
| --- | --- | --- | --- |
| `payment_discount` | 쿠폰 소유 고객 | 결제 성공 처리 로직 | 결제 모듈 전까지 사용 처리 보류 |
| `store_benefit` | 쿠폰 소유 고객 | 매장 PIN을 입력한 현장 확인 흐름 | 고객 단독 사용 처리 금지 |

## 매장 PIN 기반 혜택 쿠폰 사용 흐름

매장 혜택 쿠폰의 1차 확인 수단은 기존 매장 PIN을 사용한다.

흐름:

1. 고객이 앱에서 매장 혜택 쿠폰 상세 화면을 연다.
2. 매장 직원이 혜택 제공 전 쿠폰 내용을 확인한다.
3. 고객 앱의 사용 확인 화면에 매장 직원이 매장 PIN을 입력한다.
4. 서버는 쿠폰과 매장 PIN을 검증한다.
5. 검증이 성공하면 쿠폰 상태를 `used`로 변경하고 `used_at`을 기록한다.

검증 조건:

- 쿠폰이 존재해야 한다.
- 쿠폰의 `customer_id`가 JWT의 고객 ID와 일치해야 한다.
- 쿠폰 타입은 `store_benefit`이어야 한다.
- 쿠폰 상태는 `active`여야 한다.
- `expires_at`이 현재 시각보다 미래여야 한다.
- 쿠폰에는 `store_id`가 있어야 한다.
- 입력한 PIN이 쿠폰의 `store_id` 매장 PIN과 일치해야 한다.
- 매장 PIN이 잠겨 있으면 사용 처리하지 않는다.

비회원 예약에서 발급된 쿠폰도 같은 PIN 사용 흐름을 따른다.
다만 고객 JWT 대신 전화번호와 예약 조회 토큰을 소유권 검증 수단으로 사용한다.

권장 엔드포인트:

```txt
POST /api/customer/coupons/:couponId/redeem
```

요청 body:

```json
{
  "storePin": "1234"
}
```

성공 응답 data 예시:

```json
{
  "id": "coup_...",
  "status": "used",
  "usedAt": "2026-04-28T12:00:00.000Z"
}
```

## PIN 검증 재사용 기준

현재 `StorePinService`는 아래 정책을 가진다.

- PIN은 해시로 저장한다.
- 실패 5회 시 잠금 처리한다.
- 잠금 시간은 10분이다.
- 성공 시 실패 횟수와 잠금을 초기화한다.

쿠폰 사용에서도 동일한 정책을 사용한다.
다만 현재 `checkPin(storeId, dto)`는 매장 API 용도이므로, coupon 모듈에서는 아래처럼 내부 재사용 메서드를 추가하는 방향을 권장한다.

```ts
verifyPinForStore(storeId: string, pin: string): Promise<void>
```

이 메서드는 응답 data를 반환하기보다 검증 실패 시 예외를 던지고, 성공 시 조용히 통과하는 형태가 coupon 사용 트랜잭션에 적합하다.

## 쿠폰 상태

현재 DB의 `coupons.status`는 아래 의미로 사용한다.

| status | 의미 |
| --- | --- |
| `active` | 사용 가능 |
| `used` | 사용 완료 |
| `expired` | 만료 |

정책:

- 만료 시간이 지난 쿠폰은 조회 시 `expired`로 갱신하거나, 사용 시 즉시 거부하고 `expired`로 변경한다.
- `used` 쿠폰은 어떤 경우에도 다시 사용할 수 없다.
- 결제 할인 쿠폰의 환불 복구는 결제 모듈에서 별도 정책으로 정의한다.

## 중복 발급 기준

중복 발급 기준은 trigger와 type에 따라 다르게 둔다.

권장 기준:

- `signup`: 고객당 정책당 1회
- `checkin_completed`: 예약당 정책당 1회
- `manual_claim`: 고객당 정책당 1회 또는 캠페인 정책에 따름

비회원 전화번호 기반 쿠폰은 아래 기준으로 중복 발급을 방어한다.

- `checkin_completed`: 전화번호 + 예약당 정책당 1회
- `manual_claim`: 1차 미지원
- 동일 전화번호의 고객 계정 전환 시 쿠폰 병합 또는 이전 정책은 추후 검토

현재 `coupons` 테이블에는 `policy_id` 컬럼이 없다.
정책 단위 중복 발급을 엄격히 막으려면 추후 아래 컬럼 추가를 검토한다.

```sql
policy_id VARCHAR(255) NULL
```

1차 구현에서는 기존 스키마를 유지하고, 가능한 범위에서 `reservation_id`, `customer_id`, `phone_snapshot`, `store_id`, `type`, `title` 조합으로 중복을 방어한다.

## 현재 스키마 매핑

`coupon_policies`

| 컬럼 | 의미 |
| --- | --- |
| `store_id` | 매장 혜택 쿠폰이면 해당 매장 ID, 서비스 쿠폰이면 null 가능 |
| `type` | `payment_discount` 또는 `store_benefit` |
| `discount_amount` | 정액 할인 |
| `discount_rate` | 정률 할인 |
| `min_spend` | 최소 결제 금액 |
| `max_discount` | 정률 할인 최대 금액 |
| `benefit_item` | 매장 혜택 품목 |
| `benefit_value` | 매장 혜택 값 |
| `auto_issue_on` | 발급 트리거 |
| `validity_days` | 발급 후 유효기간 |
| `enabled` | 정책 활성 여부 |

`coupons`

| 컬럼 | 의미 |
| --- | --- |
| `customer_id` | 쿠폰 소유 고객 |
| `store_id` | 매장 혜택 쿠폰 대상 매장 |
| `type` | 쿠폰 유형 |
| `title`, `description` | 쿠폰 표시 정보 |
| `discount_amount`, `discount_rate`, `min_spend`, `max_discount` | 결제 할인 정보 |
| `benefit_item`, `benefit_value` | 매장 혜택 정보 |
| `status` | `active`, `used`, `expired` |
| `issued_at`, `expires_at`, `used_at` | 발급/만료/사용 시각 |
| `reservation_id` | 체크인/예약 기반 발급 연결 |
| `phone_snapshot` | 비회원 쿠폰의 발급 시점 전화번호 |
| `payment_id` | 결제 기반 사용 연결. 결제 모듈 전까지는 사용하지 않음 |

## 1차 구현 범위

1차 coupon 모듈에서 구현할 범위:

- 고객 쿠폰 목록 조회
- 고객 쿠폰 상세 조회
- 고객 쿠폰 통계 조회
- 매장 혜택 쿠폰 PIN 기반 사용 처리
- 매장 쿠폰 정책 CRUD
- 체크인 완료 시 `store_benefit` 자동 발급 유지 또는 보강
- 체크인 자동 발급은 로그인 고객과 비회원 예약을 모두 처리
- 로그인 고객은 `customer_id`, 비회원은 `phone_snapshot` 기준으로 발급
- 비회원 쿠폰 조회/사용은 전화번호 + 예약 조회 토큰 검증 후 허용
- `payment_discount` 쿠폰은 발급/조회만 지원하고 결제 적용은 보류

1차에서 제외할 범위:

- PG 결제 금액에 쿠폰 반영
- 환불 시 쿠폰 복구
- QR 스캔 기반 사용 확인
- 비회원 manual_claim 쿠폰 발급
- 쿠폰 정책별 재고/총 발급 수량 제한
- 관리자 캠페인 쿠폰 대량 발급
- 실제 정산 반영

## 비회원 쿠폰 정책

비회원 예약에는 고객 계정 ID 대신 전화번호를 쿠폰 소유권 기준으로 사용한다.
현재 `coupons` 테이블에는 `phone_snapshot` 컬럼이 있으므로 발급 시점 전화번호 저장은 가능하다.

기본 원칙:

- 자동 발급 시 `customer_id`에는 `guest_phone_{normalizedPhone}` 형식의 내부 소유자 키를 저장한다.
- 자동 발급 시 `phone_snapshot`에는 하이픈/공백을 제거한 전화번호를 저장한다.
- 쿠폰 조회/상세/사용은 `phoneNumber`와 비회원 예약 조회 토큰을 함께 검증한다.
- `reservation_id`가 연결된 쿠폰은 해당 예약의 토큰과 전화번호가 일치해야 한다.
- 매장 혜택 쿠폰 사용은 전화번호/토큰 검증 후 매장 PIN까지 검증해야 한다.

비회원 쿠폰 API:

```txt
GET  /api/guest/coupons?phoneNumber=01012345678&token=...
GET  /api/guest/coupons/:id?phoneNumber=01012345678&token=...
POST /api/guest/coupons/:id/redeem
```

비회원 쿠폰 사용 요청 body:

```json
{
  "phoneNumber": "01012345678",
  "token": "guest-reservation-token",
  "storePin": "1234"
}
```

추후 검토:

- 전화번호 인증 기반 쿠폰 조회
- 회원가입 시 동일 전화번호의 활성 쿠폰을 계정 쿠폰으로 병합
- 비회원 manual_claim 쿠폰 발급

## 향후 확장 후보

필요 시 아래 컬럼을 추가 검토한다.

```sql
ALTER TABLE coupons
  ADD COLUMN policy_id VARCHAR(255) NULL,
  ADD COLUMN redeem_code VARCHAR(20) UNIQUE NULL,
  ADD COLUMN redeemed_by_store_id VARCHAR(255) NULL;
```

각 컬럼의 목적:

- `policy_id`: 정책 단위 중복 발급 방지와 분석
- `redeem_code`: PIN 대신 또는 PIN과 함께 사용할 짧은 사용 코드
- `redeemed_by_store_id`: 실제 사용 확인 매장 추적

현재는 스키마 변경 없이 기존 컬럼과 매장 PIN으로 1차 구현한다.
