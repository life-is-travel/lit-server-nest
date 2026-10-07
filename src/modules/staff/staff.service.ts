import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, store_staff, store_staff_status } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/database/prisma.service';
import { TokenService } from '../auth/services/token.service';
import { CreateStaffDto, RedeemInviteCodeDto } from './dto/staff.dto';
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
} from './utils/invite-code.util';

const MAX_ACTIVE_STAFF = 10;
const INVITE_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const LEFT_STAFF_NAME = '탈퇴한 직원';

export type StaffItem = {
  id: string;
  name: string;
  status: store_staff_status;
  joinedAt: Date | null;
  lastActiveAt: Date | null;
  pendingInvite: { expiresAt: Date } | null;
};

export type IssuedInviteCode = {
  staff: StaffItem;
  inviteCode: string;
  expiresAt: Date;
};

/**
 * 직원 계정(F-024). 직원은 비밀번호 없이 점주가 발급한 일회용 초대코드로만 시작한다.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async listStaff(
    storeId: string,
    includeRevoked: boolean,
  ): Promise<{ items: StaffItem[] }> {
    const now = new Date();
    const staff = await this.prisma.store_staff.findMany({
      where: {
        store_id: storeId,
        ...(includeRevoked ? {} : { status: store_staff_status.active }),
      },
      orderBy: { created_at: 'asc' },
      include: {
        store_staff_invite_codes: {
          where: { used_at: null, revoked_at: null, expires_at: { gt: now } },
          orderBy: { expires_at: 'desc' },
          take: 1,
          select: { expires_at: true },
        },
      },
    });

    return {
      items: staff.map((member) =>
        toStaffItem(member, member.store_staff_invite_codes[0]?.expires_at),
      ),
    };
  }

  async createStaff(
    storeId: string,
    dto: CreateStaffDto,
  ): Promise<IssuedInviteCode> {
    const name = dto.name.trim();

    return this.prisma.$transaction(async (tx) => {
      const activeCount = await tx.store_staff.count({
        where: { store_id: storeId, status: store_staff_status.active },
      });

      if (activeCount >= MAX_ACTIVE_STAFF) {
        throw new ConflictException({
          code: 'STAFF_LIMIT_EXCEEDED',
          message: `직원은 최대 ${MAX_ACTIVE_STAFF}명까지 등록할 수 있습니다.`,
          details: { limit: MAX_ACTIVE_STAFF },
        });
      }

      const staff = await tx.store_staff.create({
        data: { id: `staff_${randomUUID()}`, store_id: storeId, name },
      });

      return this.issueInviteCode(tx, staff);
    });
  }

  async reissueInviteCode(
    storeId: string,
    staffId: string,
  ): Promise<IssuedInviteCode> {
    const staff = await this.findActiveStaffOrThrow(storeId, staffId);

    return this.prisma.$transaction(async (tx) => {
      await this.revokeUnusedCodes(tx, staff.id);
      return this.issueInviteCode(tx, staff);
    });
  }

  async revokeStaff(storeId: string, staffId: string): Promise<void> {
    const staff = await this.findActiveStaffOrThrow(storeId, staffId);
    await this.prisma.$transaction((tx) => this.revoke(tx, staff.id));
  }

  /** 직원 스스로 나가기. 해제와 같고 이름도 익명화한다(계정 삭제 정책). */
  async leave(storeId: string, staffId: string): Promise<void> {
    const staff = await this.findActiveStaffOrThrow(storeId, staffId);
    await this.prisma.$transaction((tx) =>
      this.revoke(tx, staff.id, { name: LEFT_STAFF_NAME }),
    );
  }

  async redeem(dto: RedeemInviteCodeDto) {
    const now = new Date();
    const invite = await this.prisma.store_staff_invite_codes.findUnique({
      where: { code_hash: hashInviteCode(dto.code) },
      include: { store_staff: { include: { stores: true } } },
    });

    const staff = invite?.store_staff;
    const store = staff?.stores;
    const usable =
      invite &&
      staff &&
      store &&
      !invite.used_at &&
      !invite.revoked_at &&
      invite.expires_at > now &&
      staff.status === store_staff_status.active &&
      !store.closed_at;

    if (!usable) {
      throw invalidInviteCode();
    }

    const accessToken = this.tokenService.generateStaffAccessToken(
      store.id,
      staff.id,
    );
    const refreshToken = this.tokenService.generateStaffRefreshToken(
      store.id,
      staff.id,
    );

    await this.prisma.$transaction(async (tx) => {
      // used_at IS NULL 조건으로 사용 처리해 동시에 같은 코드를 두 번 쓰지 못하게 한다.
      const used = await tx.store_staff_invite_codes.updateMany({
        where: { id: invite.id, used_at: null, revoked_at: null },
        data: { used_at: now },
      });

      if (used.count !== 1) {
        throw invalidInviteCode();
      }

      await tx.store_staff.update({
        where: { id: staff.id },
        data: {
          ...(staff.joined_at ? {} : { joined_at: now }),
          last_active_at: now,
          updated_at: now,
        },
      });

      await tx.refresh_tokens.create({
        data: {
          store_id: store.id,
          staff_id: staff.id,
          token: refreshToken,
          expires_at: this.tokenService.getStoreRefreshTokenExpiresAt(),
        },
      });
    });

    return {
      token: accessToken,
      refreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
      // 직원에게는 점주 개인·사업자 정보를 내려주지 않는다.
      user_info: {
        id: store.id,
        storeId: store.id,
        role: 'staff' as const,
        staffId: staff.id,
        staffName: staff.name,
        email: null,
        businessName: store.business_name,
        phoneNumber: null,
        storePhoneNumber: store.store_phone_number,
        notificationPhone: null,
        notificationPhones: [],
        profileImageUrl: store.profile_image_url,
        wantsSmsNotification: false,
        businessType: store.business_type ?? null,
        hasCompletedSetup: Boolean(store.has_completed_setup),
        businessNumber: null,
        representativeName: null,
        address: store.address,
        detailAddress: store.detail_address,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
      },
    };
  }

  private async findActiveStaffOrThrow(
    storeId: string,
    staffId: string,
  ): Promise<store_staff> {
    const staff = await this.prisma.store_staff.findFirst({
      where: {
        id: staffId,
        store_id: storeId,
        status: store_staff_status.active,
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: '직원을 찾을 수 없습니다.',
      });
    }

    return staff;
  }

  private async issueInviteCode(
    tx: Prisma.TransactionClient,
    staff: store_staff,
  ): Promise<IssuedInviteCode> {
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_CODE_TTL_MS);

    await tx.store_staff_invite_codes.create({
      data: {
        staff_id: staff.id,
        store_id: staff.store_id,
        code_hash: hashInviteCode(code),
        expires_at: expiresAt,
      },
    });

    return {
      staff: toStaffItem(staff, expiresAt),
      inviteCode: formatInviteCode(code),
      expiresAt,
    };
  }

  private async revoke(
    tx: Prisma.TransactionClient,
    staffId: string,
    extra: Prisma.store_staffUpdateInput = {},
  ): Promise<void> {
    const now = new Date();

    await tx.store_staff.update({
      where: { id: staffId },
      data: {
        ...extra,
        status: store_staff_status.revoked,
        revoked_at: now,
        updated_at: now,
      },
    });
    await tx.refresh_tokens.deleteMany({ where: { staff_id: staffId } });
    await this.revokeUnusedCodes(tx, staffId, now);
  }

  private async revokeUnusedCodes(
    tx: Prisma.TransactionClient,
    staffId: string,
    now = new Date(),
  ): Promise<void> {
    await tx.store_staff_invite_codes.updateMany({
      where: { staff_id: staffId, used_at: null, revoked_at: null },
      data: { revoked_at: now },
    });
  }
}

const toStaffItem = (
  staff: store_staff,
  pendingExpiresAt: Date | undefined,
): StaffItem => ({
  id: staff.id,
  name: staff.name,
  status: staff.status,
  joinedAt: staff.joined_at,
  lastActiveAt: staff.last_active_at,
  pendingInvite: pendingExpiresAt ? { expiresAt: pendingExpiresAt } : null,
});

// 없음·만료·사용됨·해제·탈퇴 매장을 구분하지 않아 코드 존재 여부를 알 수 없게 한다.
const invalidInviteCode = () =>
  new BadRequestException({
    code: 'INVITE_CODE_INVALID',
    message: '초대코드가 올바르지 않거나 만료되었습니다.',
  });
