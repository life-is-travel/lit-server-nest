import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['mysql'] })
    .required(),

  JWT_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('30d'),
  // 관리자 토큰은 점주·고객과 다른 시크릿으로 서명한다(상호 위조 방지).
  JWT_ADMIN_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_ADMIN_REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),

  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('docs'),

  AUTH_RATE_LIMIT_TTL: Joi.number()
    .integer()
    .min(1000)
    .default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(5),

  EMAIL_HOST: Joi.string().default('smtp.gmail.com'),
  EMAIL_PORT: Joi.number().port().default(587),
  EMAIL_SECURE: Joi.boolean().default(false),
  EMAIL_USER: Joi.string().allow('', null).optional(),
  EMAIL_PASSWORD: Joi.string().allow('', null).optional(),
  EMAIL_FROM: Joi.string().default('Life is Travel <contact@lifeistravel.io>'),
  EMAIL_VERIFICATION_CODE_LENGTH: Joi.number()
    .integer()
    .min(4)
    .max(10)
    .default(6),
  EMAIL_VERIFICATION_CODE_EXPIRES_IN: Joi.number()
    .integer()
    .min(30)
    .default(180),
  EMAIL_VERIFICATION_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),

  FEEDBACK_IP_HASH_SECRET: Joi.string().min(32).required(),

  // 카카오 REST API 키 (https://developers.kakao.com)
  // 주소 검색 및 지오코딩에 사용
  KAKAO_REST_API_KEY: Joi.string().required(),

  // 공공데이터포털 한국천문연구원 특일 정보 API 인증키(선택).
  // 없으면 공휴일 자동 동기화를 건너뛰고 DB에 들어있는 값(시드·수동 추가)만 쓴다.
  DATA_GO_KR_SERVICE_KEY: Joi.string().allow('', null).optional(),

  // Cloudflare R2 Object Storage
  CF_R2_ACCOUNT_ID: Joi.string().required(),
  CF_R2_BUCKET: Joi.string().required(),
  CF_R2_ACCESS_KEY_ID: Joi.string().required(),
  CF_R2_SECRET_ACCESS_KEY: Joi.string().required(),
  // 버킷 Public Access 활성화 시 설정 (예: https://pub-xxxx.r2.dev)
  CF_R2_PUBLIC_URL: Joi.string().uri().optional(),

  // 점주 액션 링크(HMAC) 서명 비밀키. 미설정 시 owner-actions 엔드포인트 전체 401 잠금.
  OWNER_ACTION_SECRET: Joi.string().min(32).optional(),

  // 고객 이용완료(체크아웃) 알림톡 템플릿. 미설정 시 알림톡 채널 스킵.
  SOLAPI_KAKAO_CHECKOUT_TEMPLATE_ID: Joi.string().optional(),
});
