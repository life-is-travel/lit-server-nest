import { Prisma } from '@prisma/client';
import { CustomerStoreResponseDto } from '../dto/customer-store.dto';
import {
  CustomerStoreDetailRecord,
  CustomerStoreListRecord,
} from '../services/customer-stores.select';

export const toCustomerStoreResponse = (
  store: CustomerStoreListRecord | CustomerStoreDetailRecord,
): CustomerStoreResponseDto => ({
  id: store.id,
  slug: store.slug,
  businessName: store.business_name,
  description: store.description,
  phoneNumber: store.store_phone_number ?? store.phone_number,
  address: store.address,
  latitude: decimalToNumber(store.latitude),
  longitude: decimalToNumber(store.longitude),
  reviews: camelize(store.reviews) as Record<string, unknown>[],
  operatingHours: store.store_operating_hours
    ? (camelize(store.store_operating_hours) as Record<string, unknown>)
    : null,
  settings: store.store_settings
    ? (camelize(store.store_settings) as Record<string, unknown>)
    : null,
});

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
