import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PasswordService } from '../../auth/services/password.service';
import { StorePinDto } from '../dto/store-pin.dto';

const MAX_PIN_FAILURES = 5;
const PIN_LOCK_MINUTES = 10;

@Injectable()
export class StorePinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async setPin(storeId: string, dto: StorePinDto) {
    await this.assertStoreExists(storeId);

    const pinHash = await this.passwordService.hash(dto.pin);
    const updatedStore = await this.prisma.stores.update({
      where: { id: storeId },
      data: {
        store_pin_hash: pinHash,
        store_pin_updated_at: new Date(),
        store_pin_failed_count: 0,
        store_pin_locked_until: null,
        updated_at: new Date(),
      },
      select: {
        id: true,
        store_pin_updated_at: true,
      },
    });

    return {
      storeId: updatedStore.id,
      pinSet: true as const,
      pinUpdatedAt: updatedStore.store_pin_updated_at,
    };
  }

  async checkPin(storeId: string, dto: StorePinDto) {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        store_pin_hash: true,
        store_pin_failed_count: true,
        store_pin_locked_until: true,
      },
    });

    if (!store) {
      throw this.storeNotFound();
    }

    if (!store.store_pin_hash) {
      throw new BadRequestException({
        code: 'STORE_PIN_NOT_SET',
        message: '매장 PIN이 설정되어 있지 않습니다.',
      });
    }

    if (
      store.store_pin_locked_until &&
      store.store_pin_locked_until > new Date()
    ) {
      throw new UnauthorizedException({
        code: 'PIN_LOCKED',
        message: 'PIN 입력이 잠겼습니다. 잠시 후 다시 시도해주세요.',
        details: {
          lockedUntil: store.store_pin_locked_until,
        },
      });
    }

    const matched = await this.passwordService.compare(
      dto.pin,
      store.store_pin_hash,
    );

    if (!matched) {
      const nextFailedCount = store.store_pin_failed_count + 1;
      const shouldLock = nextFailedCount >= MAX_PIN_FAILURES;

      await this.prisma.stores.update({
        where: { id: storeId },
        data: {
          store_pin_failed_count: nextFailedCount,
          store_pin_locked_until: shouldLock
            ? this.addMinutes(new Date(), PIN_LOCK_MINUTES)
            : null,
          updated_at: new Date(),
        },
      });

      throw new UnauthorizedException({
        code: 'PIN_MISMATCH',
        message: 'PIN이 일치하지 않습니다.',
        details: {
          remainingAttempts: Math.max(MAX_PIN_FAILURES - nextFailedCount, 0),
        },
      });
    }

    await this.prisma.stores.update({
      where: { id: storeId },
      data: {
        store_pin_failed_count: 0,
        store_pin_locked_until: null,
        updated_at: new Date(),
      },
    });

    return {
      storeId,
      matched: true as const,
    };
  }

  private async assertStoreExists(storeId: string): Promise<void> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!store) {
      throw this.storeNotFound();
    }
  }

  private storeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'STORE_NOT_FOUND',
      message: '점포를 찾을 수 없습니다.',
    });
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}
