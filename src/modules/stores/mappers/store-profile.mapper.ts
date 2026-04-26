import { stores } from '@prisma/client';
import { StoreProfileResponseDto } from '../dto/store-profile.dto';

export const toStoreProfileResponse = (
  store: stores,
): StoreProfileResponseDto => ({
  id: store.id,
  email: store.email,
  businessName: store.business_name,
  phoneNumber: store.phone_number,
  storePhoneNumber: store.store_phone_number,
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
