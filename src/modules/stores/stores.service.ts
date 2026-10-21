import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  StoreProfileResponseDto,
  UpdateStoreProfileDto,
} from './dto/store-profile.dto';
import {
  StoreWithOwnerEmail,
  toStoreProfileResponse,
} from './mappers/store-profile.mapper';

const OWNER_EMAIL_INCLUDE = {
  owners: { select: { email: true } },
} satisfies Prisma.storesInclude;

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(storeId: string): Promise<StoreProfileResponseDto> {
    const store = await this.findStoreOrThrow(storeId);

    return toStoreProfileResponse(store);
  }

  async updateProfile(
    storeId: string,
    dto: UpdateStoreProfileDto,
  ): Promise<StoreProfileResponseDto> {
    const businessName = dto.businessName ?? dto.name;
    const hasChanges =
      businessName !== undefined ||
      dto.phoneNumber !== undefined ||
      dto.storePhoneNumber !== undefined ||
      dto.notificationPhone !== undefined ||
      dto.notificationPhones !== undefined ||
      dto.wantsSmsNotification !== undefined ||
      dto.representativeName !== undefined ||
      dto.address !== undefined ||
      dto.detailAddress !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined ||
      dto.businessType !== undefined ||
      dto.profileImageUrl !== undefined ||
      dto.description !== undefined ||
      dto.hasCompletedSetup !== undefined;

    if (!hasChanges) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '수정할 정보가 없습니다.',
      });
    }

    await this.findStoreOrThrow(storeId);

    const updatedStore = await this.prisma.stores.update({
      where: { id: storeId },
      data: {
        ...(businessName !== undefined
          ? { business_name: businessName.trim() }
          : {}),
        ...(dto.phoneNumber !== undefined
          ? { phone_number: dto.phoneNumber.trim() }
          : {}),
        ...(dto.storePhoneNumber !== undefined
          ? { store_phone_number: dto.storePhoneNumber.trim() }
          : {}),
        ...(dto.notificationPhone !== undefined
          ? // 빈/공백 문자열은 NULL로 저장 — '' 저장 시 ?? 폴백이 무력화되던 근원 차단
            { notification_phone: dto.notificationPhone.trim() || null }
          : {}),
        ...(dto.notificationPhones !== undefined
          ? {
              notification_phones: dto.notificationPhones
                .map((p) => p.trim())
                .filter(Boolean),
            }
          : {}),
        ...(dto.wantsSmsNotification !== undefined
          ? { wants_sms_notification: dto.wantsSmsNotification }
          : {}),
        ...(dto.representativeName !== undefined
          ? { representative_name: dto.representativeName.trim() }
          : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.detailAddress !== undefined
          ? { detail_address: dto.detailAddress.trim() }
          : {}),
        ...(dto.latitude !== undefined
          ? { latitude: new Prisma.Decimal(dto.latitude) }
          : {}),
        ...(dto.longitude !== undefined
          ? { longitude: new Prisma.Decimal(dto.longitude) }
          : {}),
        ...(dto.businessType !== undefined
          ? { business_type: dto.businessType }
          : {}),
        ...(dto.profileImageUrl !== undefined
          ? { profile_image_url: dto.profileImageUrl.trim() }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.hasCompletedSetup !== undefined
          ? { has_completed_setup: dto.hasCompletedSetup }
          : {}),
        updated_at: new Date(),
      },
      include: OWNER_EMAIL_INCLUDE,
    });

    return toStoreProfileResponse(updatedStore);
  }

  private async findStoreOrThrow(
    storeId: string,
  ): Promise<StoreWithOwnerEmail> {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
      include: OWNER_EMAIL_INCLUDE,
    });

    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: '점포를 찾을 수 없습니다.',
      });
    }

    return store;
  }
}
