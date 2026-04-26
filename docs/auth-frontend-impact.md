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
