import { Prisma, stores } from '@prisma/client';
import { StoreProfileResponseDto } from '../dto/store-profile.dto';

const toStringArray = (
  value: Prisma.JsonValue | null | undefined,
): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

/** 로그인 이메일은 점주 계정에 있다(F-026). 앱에서 추가한 매장은 stores.email이 NULL */
export type StoreWithOwnerEmail = stores & {
  owners?: { email: string } | null;
};

export const toStoreProfileResponse = (
  store: StoreWithOwnerEmail,
): StoreProfileResponseDto => ({
  id: store.id,
  email: store.owners?.email ?? store.email,
  businessName: store.business_name,
  phoneNumber: store.phone_number,
  storePhoneNumber: store.store_phone_number,
  notificationPhone: store.notification_phone,
  notificationPhones: toStringArray(store.notification_phones),
  wantsSmsNotification: store.wants_sms_notification,
  businessNumber: store.business_number,
  representativeName: store.representative_name,
  address: store.address,
  detailAddress: store.detail_address,
  latitude: store.latitude == null ? null : Number(store.latitude),
  longitude: store.longitude == null ? null : Number(store.longitude),
  businessType: store.business_type,
  profileImageUrl: store.profile_image_url,
  description: store.description,
  hasCompletedSetup: store.has_completed_setup ?? false,
  createdAt: store.created_at,
  updatedAt: store.updated_at,
});
