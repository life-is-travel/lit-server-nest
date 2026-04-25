process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL = 'mysql://root:password@localhost:3306/lit_test';
process.env.JWT_ACCESS_TOKEN_SECRET =
  'test-access-secret-value-over-32-characters';
process.env.JWT_REFRESH_TOKEN_SECRET =
  'test-refresh-secret-value-over-32-characters';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.SWAGGER_ENABLED = 'false';
