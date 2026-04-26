import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(4000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['mysql'] })
    .required(),

  JWT_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('30d'),

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
  EMAIL_FROM: Joi.string().default('Lit <noreply@lit.com>'),
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
});
