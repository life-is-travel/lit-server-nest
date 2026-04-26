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
