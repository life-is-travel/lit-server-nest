import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  reservations_status,
  store_staff_status,
  store_status_status,
  stores,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/database/prisma.service';
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
import { EmailVerificationService } from './services/email-verification.service';
import { MailService } from './services/mail.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { createFallbackStoreSlug, slugify } from './utils/slug.util';

type EmailVerificationSentResponse = {
  email: string;
  expiresIn: number;
};

type EmailVerifiedResponse = {
  verified: true;
  email: string;
};

type LogoutResponse = {
  message: string;
};

type ChangePasswordResponse = {
  message: string;
};

type WithdrawResponse = {
  message: string;
};

// 탈퇴를 막는 진행 중 예약 상태. 이 상태의 예약은 고객 짐/결제가 걸려 있다.
const ACTIVE_RESERVATION_STATUSES: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
  reservations_status.in_progress,
];

const WITHDRAWN_STORE_NAME = '폐점한 매장';
const WITHDRAWN_STAFF_NAME = '탈퇴한 직원';
const WITHDRAWN_EMAIL_DOMAIN = 'withdrawn.invalid';

const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MINUTES = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mailService: MailService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async sendEmailVerification(
    dto: SendEmailVerificationDto,
  ): Promise<EmailVerificationSentResponse> {
    const email = dto.email.trim().toLowerCase();
    const existingStore = await this.prisma.stores.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingStore) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: '이미 등록된 이메일입니다.',
        details: { email },
      });
    }

    const code = this.emailVerificationService.generateCode();

    try {
      await this.emailVerificationService.saveCode(email, code);
    } catch (error) {
      throw this.emailVerificationService.toSaveError(error);
    }

    await this.mailService.sendVerificationEmail(email, code);

    return {
      email,
      expiresIn: this.emailVerificationService.getExpiresInSeconds(),
    };
  }

  async verifyEmailCode(
    dto: VerifyEmailCodeDto,
  ): Promise<EmailVerifiedResponse> {
    const email = dto.email.trim().toLowerCase();

    await this.emailVerificationService.verifyCode(email, dto.code.trim());

    return {
      verified: true,
      email,
    };
  }

  async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const businessName = dto.businessName.trim();

    await this.emailVerificationService.assertEmailVerified(email);
    await this.assertEmailAvailable(email);

    if (dto.businessNumber) {
      await this.assertBusinessNumberAvailable(dto.businessNumber);
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const storeId = `store_${randomUUID()}`;
    const refreshToken = this.tokenService.generateRefreshToken(storeId, email);
    const accessToken = this.tokenService.generateAccessToken(storeId, email);
    const refreshTokenExpiresAt =
      this.tokenService.getStoreRefreshTokenExpiresAt();

    const createdStore = await this.prisma.$transaction(async (tx) => {
      const slug = await this.generateUniqueSlug(tx, businessName);
      const store = await tx.stores.create({
        data: {
          id: storeId,
          email,
          password_hash: passwordHash,
          phone_number: dto.phoneNumber ?? null,
          store_phone_number: dto.storePhoneNumber ?? null,
          wants_sms_notification: dto.wantsSmsNotification ?? false,
          business_number: dto.businessNumber ?? null,
          business_name: businessName,
          slug,
          representative_name: dto.representativeName ?? null,
          address: dto.address ?? null,
          detail_address: dto.detailAddress ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          business_type: dto.businessType ?? null,
          description: dto.description ?? null,
          has_completed_setup: false,
        },
      });

      await tx.store_status.create({
        data: {
          store_id: storeId,
          status: store_status_status.closed,
          reason: '신규 가입',
        },
      });

      await tx.store_settings.create({
        data: {
          store_id: storeId,
        },
      });

      await tx.refresh_tokens.create({
        data: {
          store_id: storeId,
          token: refreshToken,
          expires_at: refreshTokenExpiresAt,
        },
      });

      return store;
    });

    return this.createAuthResponse(createdStore, accessToken, refreshToken);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const store = await this.prisma.stores.findUnique({
      where: { email },
    });

    if (!store) {
      throw this.authenticationFailed();
    }

    // PIN 잠금과 동일 정책: 연속 실패 횟수(login_count)가 임계값에 도달하면
    // login_locked_until까지 로그인을 거부하고, 성공 시 카운트를 초기화한다.
    if (store.login_locked_until && store.login_locked_until > new Date()) {
      throw this.accountLocked(store.login_locked_until);
    }

    const passwordMatched = await this.passwordService.compare(
      dto.password,
      store.password_hash,
    );

    if (!passwordMatched) {
      const nextFailedCount = store.login_count + 1;
      const shouldLock = nextFailedCount >= MAX_LOGIN_FAILURES;
      const lockedUntil = shouldLock
        ? this.addMinutes(new Date(), LOGIN_LOCK_MINUTES)
        : null;

      await this.prisma.stores.update({
        where: { id: store.id },
        data: {
          login_count: nextFailedCount,
          login_locked_until: lockedUntil,
          updated_at: new Date(),
        },
      });

      if (shouldLock) {
        throw this.accountLocked(lockedUntil);
      }

      throw this.authenticationFailed(
        Math.max(MAX_LOGIN_FAILURES - nextFailedCount, 0),
      );
    }

    const accessToken = this.tokenService.generateAccessToken(
      store.id,
      store.email,
    );
    const refreshToken = this.tokenService.generateRefreshToken(
      store.id,
      store.email,
    );

    await this.prisma.refresh_tokens.create({
      data: {
        store_id: store.id,
        token: refreshToken,
        expires_at: this.tokenService.getStoreRefreshTokenExpiresAt(),
      },
    });

    // 로그인 성공: 실패 카운트와 잠금을 초기화하고 마지막 로그인 시각을 갱신한다.
    await this.prisma.stores.update({
      where: { id: store.id },
      data: {
        last_login_at: new Date(),
        login_count: 0,
        login_locked_until: null,
        updated_at: new Date(),
      },
    });

    return this.createAuthResponse(store, accessToken, refreshToken);
  }

  async changePassword(
    storeId: string,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true, password_hash: true },
    });

    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    const passwordMatched = await this.passwordService.compare(
      dto.currentPassword,
      store.password_hash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: '현재 비밀번호가 일치하지 않습니다.',
      });
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.stores.update({
        where: { id: store.id },
        data: {
          password_hash: newPasswordHash,
          updated_at: new Date(),
        },
      });

      // 비밀번호 변경 시 기존 세션(refresh 토큰)을 모두 무효화한다.
      await tx.refresh_tokens.deleteMany({
        where: { store_id: store.id },
      });
    });

    return {
      message: '비밀번호가 변경되었습니다.',
    };
  }

  /**
   * 점주 회원탈퇴. 거래기록 보관 의무(예약·결제·정산서)와 고객 데이터(리뷰)는 남기고
   * 점주 개인·사업자 정보만 비우는 익명화 방식이다. stores 행은 FK 때문에 삭제하지 않는다.
   */
  async withdraw(storeId: string, dto: WithdrawDto): Promise<WithdrawResponse> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true, password_hash: true, closed_at: true },
    });

    if (!store || store.closed_at) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    const passwordMatched = await this.passwordService.compare(
      dto.password,
      store.password_hash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: '현재 비밀번호가 일치하지 않습니다.',
      });
    }

    // 로그인할 수 없는 무작위 해시. 원래 비밀번호 해시는 보존하지 않는다.
    const unusablePasswordHash = await this.passwordService.hash(randomUUID());

    await this.prisma.$transaction(async (tx) => {
      // 예약 생성과의 경쟁을 막기 위해 검사도 트랜잭션 안에서 한다.
      const activeCount = await tx.reservations.count({
        where: {
          store_id: store.id,
          status: { in: ACTIVE_RESERVATION_STATUSES },
        },
      });

      if (activeCount > 0) {
        throw new ConflictException({
          code: 'ACTIVE_RESERVATIONS_EXIST',
          message: '진행 중인 예약이 있어 탈퇴할 수 없습니다.',
          details: { count: activeCount },
        });
      }

      const where = { store_id: store.id };
      await tx.refresh_tokens.deleteMany({ where });
      await tx.store_settlement_accounts.deleteMany({ where });
      await tx.store_settings.deleteMany({ where });
      await tx.store_operating_hours.deleteMany({ where });
      await tx.notifications.deleteMany({ where });

      const now = new Date();
      // 직원 세션은 위 refresh_tokens 삭제에 포함된다. 직원(이름 익명화)과 미사용 초대코드도 정리한다.
      await tx.store_staff.updateMany({
        where: { store_id: store.id, status: store_staff_status.active },
        data: {
          name: WITHDRAWN_STAFF_NAME,
          status: store_staff_status.revoked,
          revoked_at: now,
          updated_at: now,
        },
      });
      await tx.store_staff_invite_codes.updateMany({
        where: { store_id: store.id, used_at: null, revoked_at: null },
        data: { revoked_at: now },
      });

      await tx.stores.update({
        where: { id: store.id },
        data: {
          email: `withdrawn_${store.id}@${WITHDRAWN_EMAIL_DOMAIN}`,
          password_hash: unusablePasswordHash,
          business_name: WITHDRAWN_STORE_NAME,
          store_pin_hash: null,
          store_pin_updated_at: null,
          store_pin_failed_count: 0,
          store_pin_locked_until: null,
          phone_number: null,
          store_phone_number: null,
          notification_phone: null,
          notification_phones: Prisma.DbNull,
          wants_sms_notification: false,
          business_number: null,
          representative_name: null,
          address: null,
          detail_address: null,
          latitude: null,
          longitude: null,
          description: null,
          profile_image_url: null,
          slug: null,
          closed_at: now,
          updated_at: now,
        },
      });
    });

    return {
      message: '회원탈퇴가 완료되었습니다.',
    };
  }

  async logout(dto: RefreshTokenDto): Promise<LogoutResponse> {
    const result = await this.prisma.refresh_tokens.deleteMany({
      where: { token: dto.refreshToken },
    });

    if (result.count === 0) {
      throw new NotFoundException({
        code: 'TOKEN_NOT_FOUND',
        message: '유효하지 않은 Refresh Token입니다.',
      });
    }

    return {
      message: '로그아웃이 완료되었습니다.',
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshAccessTokenResponseDto> {
    const payload = this.tokenService.verifyRefreshToken(dto.refreshToken);
    const tokenRecord = await this.prisma.refresh_tokens.findFirst({
      where: { token: dto.refreshToken },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException({
        code: 'TOKEN_NOT_FOUND',
        message: 'Refresh Token을 찾을 수 없습니다.',
      });
    }

    if (tokenRecord.expires_at <= new Date()) {
      await this.prisma.refresh_tokens.deleteMany({
        where: { token: dto.refreshToken },
      });

      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh Token이 만료되었습니다.',
      });
    }

    if (tokenRecord.staff_id) {
      return this.refreshStaffSession(
        tokenRecord.store_id,
        tokenRecord.staff_id,
      );
    }

    const store = await this.prisma.stores.findUnique({
      where: { id: tokenRecord.store_id },
      select: { id: true, email: true },
    });

    if (!store || store.id !== payload.storeId) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    return {
      token: this.tokenService.generateAccessToken(store.id, store.email),
      expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
    };
  }

  /** 직원(F-024) 세션 갱신. 해제된 직원·탈퇴한 매장이면 거부한다. */
  private async refreshStaffSession(
    storeId: string,
    staffId: string,
  ): Promise<RefreshAccessTokenResponseDto> {
    const staff = await this.prisma.store_staff.findFirst({
      where: {
        id: staffId,
        store_id: storeId,
        status: store_staff_status.active,
        stores: { closed_at: null },
      },
      select: { id: true },
    });

    if (!staff) {
      throw new UnauthorizedException({
        code: 'STAFF_REVOKED',
        message:
          '직원 권한이 해제되었습니다. 점주에게 새 초대코드를 받아주세요.',
      });
    }

    await this.prisma.store_staff.update({
      where: { id: staff.id },
      data: { last_active_at: new Date() },
    });

    return {
      token: this.tokenService.generateStaffAccessToken(storeId, staff.id),
      expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
    };
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existingStore = await this.prisma.stores.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingStore) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: '이미 등록된 이메일입니다.',
        details: { email },
      });
    }
  }

  private async assertBusinessNumberAvailable(
    businessNumber: string,
  ): Promise<void> {
    const existingStore = await this.prisma.stores.findUnique({
      where: { business_number: businessNumber },
      select: { id: true },
    });

    if (existingStore) {
      throw new BadRequestException({
        code: 'BUSINESS_NUMBER_ALREADY_EXISTS',
        message: '이미 등록된 사업자 등록번호입니다.',
        details: { businessNumber },
      });
    }
  }

  private async generateUniqueSlug(
    tx: Prisma.TransactionClient,
    businessName: string,
  ): Promise<string> {
    const base = slugify(businessName);

    if (!base) {
      return this.generateUniqueFallbackSlug(tx);
    }

    if (!(await this.slugExists(tx, base))) {
      return base;
    }

    for (let index = 2; index <= 99; index += 1) {
      const candidate = `${base}-${index}`;

      if (!(await this.slugExists(tx, candidate))) {
        return candidate;
      }
    }

    return this.generateUniqueFallbackSlug(tx, base);
  }

  private async generateUniqueFallbackSlug(
    tx: Prisma.TransactionClient,
    prefix = 'store',
  ): Promise<string> {
    let candidate = `${prefix}-${createFallbackStoreSlug().replace(/^store-/, '')}`;

    while (await this.slugExists(tx, candidate)) {
      candidate = `${prefix}-${createFallbackStoreSlug().replace(/^store-/, '')}`;
    }

    return candidate;
  }

  private async slugExists(
    tx: Prisma.TransactionClient,
    slug: string,
  ): Promise<boolean> {
    const existingStore = await tx.stores.findUnique({
      where: { slug },
      select: { id: true },
    });

    return Boolean(existingStore);
  }

  private createAuthResponse(
    store: stores,
    token: string,
    refreshToken: string,
  ): AuthTokenResponseDto {
    return {
      token,
      refreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
      user_info: {
        id: store.id,
        storeId: store.id,
        role: 'owner',
        email: store.email,
        businessName: store.business_name,
        phoneNumber: store.phone_number,
        storePhoneNumber: store.store_phone_number,
        notificationPhone: store.notification_phone,
        notificationPhones: toStringArray(store.notification_phones),
        profileImageUrl: store.profile_image_url,
        wantsSmsNotification: Boolean(store.wants_sms_notification),
        businessType: store.business_type ?? null,
        hasCompletedSetup: Boolean(store.has_completed_setup),
        businessNumber: store.business_number,
        representativeName: store.representative_name,
        address: store.address,
        detailAddress: store.detail_address,
        latitude: store.latitude ? Number(store.latitude) : null,
        longitude: store.longitude ? Number(store.longitude) : null,
        description: store.description,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
      },
    };
  }

  private authenticationFailed(
    remainingAttempts?: number,
  ): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTHENTICATION_FAILED',
      message: '이메일 또는 비밀번호가 일치하지 않습니다.',
      ...(remainingAttempts !== undefined
        ? { details: { remainingAttempts } }
        : {}),
    });
  }

  private accountLocked(lockedUntil: Date | null): UnauthorizedException {
    return new UnauthorizedException({
      code: 'ACCOUNT_LOCKED',
      message: '로그인이 잠겼습니다. 잠시 후 다시 시도해주세요.',
      details: { lockedUntil },
    });
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}

// notification_phones는 JSON 컬럼이라 문자열 배열로 정규화한다.
// store-profile.mapper의 동일 헬퍼와 로직을 맞춘다.
const toStringArray = (
  value: Prisma.JsonValue | null | undefined,
): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};
