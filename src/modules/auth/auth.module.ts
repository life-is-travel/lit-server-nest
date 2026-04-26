import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StoreAuthGuard } from './guards/store-auth.guard';
import { EmailVerificationService } from './services/email-verification.service';
import { MailService } from './services/mail.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    MailService,
    PasswordService,
    TokenService,
    StoreAuthGuard,
  ],
  exports: [StoreAuthGuard, TokenService],
})
export class AuthModule {}
