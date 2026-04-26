import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { StoreAuthGuard } from './guards/store-auth.guard';
import { EmailVerificationService } from './services/email-verification.service';
import { MailService } from './services/mail.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('AUTH_RATE_LIMIT_TTL'),
          limit: configService.getOrThrow<number>('AUTH_RATE_LIMIT_LIMIT'),
          getTracker: (request: Record<string, unknown>) => {
            const body = request.body as { email?: unknown } | undefined;

            if (typeof body?.email === 'string' && body.email.length > 0) {
              return body.email.trim().toLowerCase();
            }

            return typeof request.ip === 'string' ? request.ip : 'unknown';
          },
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthThrottlerGuard,
    EmailVerificationService,
    MailService,
    PasswordService,
    TokenService,
    StoreAuthGuard,
  ],
  exports: [StoreAuthGuard, TokenService],
})
export class AuthModule {}
