import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import {
  AuthTokenResponseDto,
  RefreshAccessTokenResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendEmailVerificationDto } from './dto/send-email-verification.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { AuthService } from './auth.service';

@ApiTags('Store Auth')
@UseGuards(AuthThrottlerGuard)
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/send-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @ApiOperation({ summary: '매장 이메일 인증 코드를 발송합니다.' })
  @ApiOkResponse()
  sendEmailVerification(@Body() dto: SendEmailVerificationDto) {
    return this.authService.sendEmailVerification(dto);
  }

  @Post('email/verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 이메일 인증 코드를 검증합니다.' })
  @ApiOkResponse()
  verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailCode(dto);
  }

  @Post('register')
  @ApiOperation({ summary: '매장 계정을 생성합니다.' })
  @ApiCreatedResponse({ type: AuthTokenResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 계정으로 로그인합니다.' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 Refresh Token을 폐기합니다.' })
  @ApiOkResponse()
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 Access Token을 재발급합니다.' })
  @ApiOkResponse({ type: RefreshAccessTokenResponseDto })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }
}
