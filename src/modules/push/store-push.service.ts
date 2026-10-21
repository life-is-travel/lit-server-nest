import { Injectable, Logger } from '@nestjs/common';
import {
  store_push_devices_platform,
  store_staff_status,
} from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import type { AuthenticatedStore } from '../auth/guards/store-auth.guard';
import { FcmSenderService, PushMessage } from './fcm-sender.service';

/** 매장 앱 기기 등록과 매장 단위 푸시 발송. 점주·직원 기기 모두 받는다. */
@Injectable()
export class StorePushService {
  private readonly logger = new Logger(StorePushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmSender: FcmSenderService,
  ) {}

  /**
   * 토큰은 기기당 하나라 upsert한다. 같은 기기가 다른 매장·직원으로 다시 로그인하면
   * 행이 새 소유자로 옮겨가 이전 매장 알림이 더 오지 않는다.
   */
  async registerDevice(
    actor: AuthenticatedStore,
    pushToken: string,
    platform: store_push_devices_platform,
  ): Promise<void> {
    const isStaff = actor.role === 'staff';
    // 점주 기기는 점주 계정에 묶어 그 점주의 모든 매장 푸시를 받게 한다(F-026).
    const store = isStaff
      ? null
      : await this.prisma.stores.findUnique({
          where: { id: actor.storeId },
          select: { owner_id: true },
        });
    const owner = {
      store_id: actor.storeId,
      staff_id: isStaff ? (actor.staffId ?? null) : null,
      owner_id: store?.owner_id ?? null,
      platform,
      updated_at: new Date(),
    };
    await this.prisma.store_push_devices.upsert({
      where: { push_token: pushToken },
      create: { push_token: pushToken, ...owner },
      update: owner,
    });
  }

  /** 로그아웃·나가기 직전에 앱이 호출한다. 자기 매장 토큰만 지운다. */
  async unregisterDevice(storeId: string, pushToken: string): Promise<void> {
    await this.prisma.store_push_devices.deleteMany({
      where: { store_id: storeId, push_token: pushToken },
    });
  }

  /**
   * 매장 점주의 기기(지금 어느 매장에 들어가 있든) + 이 매장 활성 직원 기기로 발송한다.
   * 해제된 직원 기기는 해제 시 지우지만, 남아 있어도 여기서 한 번 더 거른다.
   */
  async notifyStore(storeId: string, message: PushMessage): Promise<void> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { owner_id: true },
    });
    const ownerDevices = store?.owner_id
      ? [{ owner_id: store.owner_id, staff_id: null }]
      : [];

    const devices = await this.prisma.store_push_devices.findMany({
      where: {
        OR: [
          ...ownerDevices,
          {
            store_id: storeId,
            store_staff: { status: store_staff_status.active },
          },
        ],
      },
      select: { push_token: true },
    });
    if (devices.length === 0) {
      return;
    }

    const tokens = devices.map((device) => device.push_token);
    const { successCount, staleTokens } = await this.fcmSender.send(
      tokens,
      message,
    );

    if (staleTokens.length > 0) {
      await this.prisma.store_push_devices.deleteMany({
        where: { push_token: { in: staleTokens } },
      });
    }

    this.logger.log({
      event: 'push.store_notified',
      storeId,
      type: message.data.type,
      deviceCount: tokens.length,
      successCount,
      staleCount: staleTokens.length,
    });
  }
}
