# 운영 고려사항

이 문서는 NestJS 서버를 실제 운영 환경으로 올릴 때 확인해야 할 항목을 정리합니다.
현재 구현은 운영 수준으로 확장 가능한 구조를 목표로 하지만, 배포 규모와 인프라에 따라 추가 결정이 필요합니다.

## Rate Limit 저장소

현재 Auth rate limit은 `@nestjs/throttler` 기본 in-memory storage를 사용합니다.

이 방식은 단일 서버 인스턴스에서는 동작하지만, 서버를 여러 대로 늘리면 인스턴스마다 카운터가 따로 관리됩니다.

예:

```txt
서버 A: login 요청 5회
서버 B: login 요청 5회
서버 C: login 요청 5회
```

로드밸런서를 통해 요청이 분산되면 실제로는 한 사용자가 제한보다 많은 요청을 보낼 수 있습니다.

운영에서 서버 인스턴스가 2대 이상이면 Redis 같은 공유 저장소를 사용하는 방식으로 바꿔야 합니다.

권장 방향:

```txt
@nestjs/throttler
  -> Redis storage provider 연결
  -> 모든 서버 인스턴스가 같은 rate limit 카운터 사용
```

적용 대상:

- `POST /api/auth/email/send-verification`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- 이후 고객 auth API
- 결제 준비/승인 API

## Swagger 운영 노출

Swagger는 개발과 테스트에는 유용하지만 운영 환경에 항상 공개하면 API 구조가 외부에 노출됩니다.

현재는 아래 환경변수로 제어합니다.

```env
SWAGGER_ENABLED=false
```

운영 권장값:

```txt
production: SWAGGER_ENABLED=false
staging:    SWAGGER_ENABLED=true 또는 IP 제한
local:      SWAGGER_ENABLED=true
```

운영에서도 Swagger가 필요하다면 최소한 다음 중 하나를 적용해야 합니다.

- 사내 IP 제한
- Basic Auth
- VPN 내부망에서만 접근

## 환경변수 관리

`.env`는 로컬 개발용입니다.
운영에서는 배포 플랫폼의 환경변수 관리 기능을 사용해야 합니다.

필수 관리 대상:

- `DATABASE_URL`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- 결제 관련 secret
- 향후 S3/NCP Object Storage access key

주의:

- 실제 secret은 git에 커밋하지 않습니다.
- `.env.example`에는 샘플 값만 둡니다.
- JWT secret은 충분히 긴 랜덤 문자열을 사용합니다.

## DB 연결과 Connection Pool

Prisma는 DB 연결 풀을 사용합니다.
서버 인스턴스를 늘리면 전체 DB 연결 수가 함께 늘어납니다.

예:

```txt
서버 3대 * 인스턴스당 connection 10개 = 최대 30개 연결
```

운영에서 확인할 것:

- MySQL `max_connections`
- Prisma/MariaDB adapter connection pool 설정
- Render/Railway/NCP 같은 배포 환경의 동시 인스턴스 수
- DB가 같은 리전에 있는지 여부

트래픽 증가 시에는 API 서버보다 DB가 먼저 병목이 될 가능성이 큽니다.

## Refresh Token 정책

현재는 기존 Express 서버와 호환되도록 refresh token을 유지한 채 access token만 재발급합니다.

보안 강화를 위해 나중에 refresh token rotation을 도입할 수 있습니다.
다만 이 변경은 프론트 저장 로직에 영향을 줍니다.

관련 내용은 `docs/auth-frontend-impact.md`에 따로 정리합니다.

## 로깅과 모니터링

운영에서는 `console.log`만으로 충분하지 않습니다.

추가 고려 대상:

- 요청 로그
- 에러 로그
- DB 쿼리 에러
- 외부 API 실패 로그
- 결제 승인/취소 로그
- 정산 배치 로그

추후 선택지:

- Nest Logger 확장
- Winston/Pino
- Sentry
- Grafana/Prometheus
- 배포 플랫폼 로그 수집

## 보안 헤더

운영 API 서버에는 보안 헤더 설정이 필요합니다.

추후 적용 후보:

```txt
helmet
```

적용 시 확인할 것:

- CORS 설정과 충돌 여부
- Swagger UI 접근 여부
- 프론트 도메인 허용 정책

## CORS 정책

현재 CORS는 `CORS_ORIGIN` 환경변수로 관리합니다.

운영에서는 와일드카드(`*`) 대신 실제 프론트 도메인만 허용해야 합니다.

예:

```env
CORS_ORIGIN="https://www.lifeistravel.io"
```

여러 도메인을 허용해야 하면 문자열 하나가 아니라 배열 파싱 방식으로 확장해야 합니다.

## CI 검증

PR마다 최소한 아래 명령이 자동 실행되어야 합니다.

```powershell
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

추후 GitHub Actions로 추가하는 것을 권장합니다.

## 배포 전 체크리스트

- `.env.example` 최신화
- 운영 환경변수 등록
- `SWAGGER_ENABLED=false`
- DB connection pool 확인
- Rate limit Redis storage 적용 여부 확인
- CORS 운영 도메인 확인
- build/lint/test 통과
- Health Check API 응답 확인
- 로그 수집 경로 확인
