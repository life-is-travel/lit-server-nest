import { Prisma } from '@prisma/client';

const CUSTOMER_STORE_BASE_SELECT = {
  id: true,
  slug: true,
  business_name: true,
  description: true,
  phone_number: true,
  store_phone_number: true,
  address: true,
  latitude: true,
  longitude: true,
  store_operating_hours: true,
  store_settings: true,
} satisfies Prisma.storesSelect;

export const CUSTOMER_STORE_LIST_SELECT = {
  ...CUSTOMER_STORE_BASE_SELECT,
  reviews: {
    orderBy: { created_at: 'desc' },
    take: 20,
  },
} satisfies Prisma.storesSelect;

export const CUSTOMER_STORE_DETAIL_SELECT = {
  ...CUSTOMER_STORE_BASE_SELECT,
  reviews: {
    orderBy: { created_at: 'desc' },
  },
} satisfies Prisma.storesSelect;

export type CustomerStoreListRecord = Prisma.storesGetPayload<{
  select: typeof CUSTOMER_STORE_LIST_SELECT;
}>;

export type CustomerStoreDetailRecord = Prisma.storesGetPayload<{
  select: typeof CUSTOMER_STORE_DETAIL_SELECT;
}>;
