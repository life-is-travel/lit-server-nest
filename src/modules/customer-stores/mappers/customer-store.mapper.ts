import { Prisma } from '@prisma/client';
import { maskReviewAuthorDisplay } from '../../../common/transformers/mask-contact.util';
import { resolveOwnerPhone } from '../../../common/transformers/resolve-owner-phone.util';
import { CustomerStoreResponseDto } from '../dto/customer-store.dto';
import {
  CustomerStoreDetailRecord,
  CustomerStoreListRecord,
} from '../services/customer-stores.select';

type CustomerStoreRecord = CustomerStoreListRecord | CustomerStoreDetailRecord;
type ReviewRecord = CustomerStoreRecord['reviews'][number];

export const toCustomerStoreResponse = (
  store: CustomerStoreRecord,
): CustomerStoreResponseDto => ({
  id: store.id,
  slug: store.slug,
  businessName: store.business_name,
  description: store.description,
  phoneNumber: store.store_phone_number ?? null,
  ownerPhone:
    resolveOwnerPhone(store.notification_phone, store.phone_number) || null,
  address: store.address,
  latitude: decimalToNumber(store.latitude),
  longitude: decimalToNumber(store.longitude),
  businessType: store.business_type ?? null,
  reviews: store.reviews.map(mapReviewForPublic),
  operatingHours: store.store_operating_hours
    ? (camelize(store.store_operating_hours) as Record<string, unknown>)
    : null,
  settings: store.store_settings
    ? (camelize(store.store_settings) as Record<string, unknown>)
    : null,
  reservationCount: store._count.reservations,
});

const mapReviewForPublic = (review: ReviewRecord): Record<string, unknown> => {
  const mapped = camelize(review) as Record<string, unknown>;
  const reservation = mapped.reservations as
    | {
        customerPhone?: string | null;
        customerEmail?: string | null;
      }
    | null
    | undefined;

  mapped.customerName = maskReviewAuthorDisplay({
    phone: reservation?.customerPhone,
    email: reservation?.customerEmail,
    fallback: mapped.customerName as string,
  });
  delete mapped.reservations;
  return mapped;
};

const decimalToNumber = (value: Prisma.Decimal | null): number | null => {
  if (!value) {
    return null;
  }

  return value.toNumber();
};

const toCamel = (value: string): string =>
  value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

const camelize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }

  if (value instanceof Date || value instanceof Prisma.Decimal) {
    return value;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (acc, [key, item]) => {
        acc[toCamel(key)] = camelize(item);
        return acc;
      },
      {},
    );
  }

  return value;
};
