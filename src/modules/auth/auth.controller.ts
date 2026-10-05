import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { StoreAuthGuard } from './guards/store-auth.guard';
import { CurrentStoreId } from './decorators/current-store.decorator';
import {
  AuthTokenResponseDto,
  RefreshAccessTokenResponseDto,
} from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendEmailVerificationDto } from './dto/send-email-verification.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { WithdrawDto } from './dto/withdraw.dto';
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

  @Patch('password')
  @UseGuards(StoreAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매장 비밀번호를 변경합니다.' })
  @ApiOkResponse()
  changePassword(
    @CurrentStoreId() storeId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(storeId, dto);
  }

  @Post('withdraw')
  @UseGuards(StoreAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '매장 계정을 탈퇴(개인정보 익명화)하고 고객 노출을 중단합니다.',
  })
  @ApiOkResponse()
  withdraw(@CurrentStoreId() storeId: string, @Body() dto: WithdrawDto) {
    return this.authService.withdraw(storeId, dto);
  }
}
