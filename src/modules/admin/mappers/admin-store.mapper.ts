import { store_status_status } from '@prisma/client';
import {
  AdminStoreListItemDto,
  AdminStoreSummaryStoreDto,
  StoreOpsMetricsDto,
} from '../dto/admin-store-ops.dto';
import { AdminStoreRecord } from '../services/admin-store.service';

export const toAdminStoreListItem = (
  store: AdminStoreRecord,
  storeStatus: store_status_status,
  metrics: StoreOpsMetricsDto,
): AdminStoreListItemDto => ({
  storeId: store.id,
  businessName: store.business_name,
  email: store.owners?.email ?? store.email ?? '',
  businessType: store.business_type,
  hasCompletedSetup: store.has_completed_setup ?? false,
  storeStatus,
  createdAt: store.created_at,
  lastLoginAt: store.last_login_at,
  metrics,
});

export const toAdminStoreSummaryStore = (
  store: AdminStoreRecord,
  storeStatus: store_status_status,
): AdminStoreSummaryStoreDto => ({
  id: store.id,
  businessName: store.business_name,
  email: store.owners?.email ?? store.email ?? '',
  businessType: store.business_type,
  businessNumber: store.business_number,
  representativeName: store.representative_name,
  address: store.address,
  phoneNumber: store.phone_number,
  storePhoneNumber: store.store_phone_number,
  hasCompletedSetup: store.has_completed_setup ?? false,
  storeStatus,
  createdAt: store.created_at,
  lastLoginAt: store.last_login_at,
});
