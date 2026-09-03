import { Prisma, reservations_status } from '@prisma/client';

const CUSTOMER_STORE_BASE_SELECT = {
  id: true,
  slug: true,
  business_name: true,
  description: true,
  phone_number: true,
  store_phone_number: true,
  notification_phone: true,
  address: true,
  latitude: true,
  longitude: true,
  business_type: true,
  store_operating_hours: true,
  store_settings: true,
  _count: {
    select: {
      reservations: {
        where: {
          status: {
            notIn: [
              reservations_status.cancelled,
              reservations_status.rejected,
            ],
          },
        },
      },
    },
  },
} satisfies Prisma.storesSelect;

export const CUSTOMER_STORE_LIST_SELECT = {
  ...CUSTOMER_STORE_BASE_SELECT,
  reviews: {
    orderBy: { created_at: 'desc' },
    take: 20,
    include: {
      reservations: {
        select: {
          customer_phone: true,
          customer_email: true,
        },
      },
    },
  },
} satisfies Prisma.storesSelect;

export const CUSTOMER_STORE_DETAIL_SELECT = {
  ...CUSTOMER_STORE_BASE_SELECT,
  reviews: {
    orderBy: { created_at: 'desc' },
    include: {
      reservations: {
        select: {
          customer_phone: true,
          customer_email: true,
        },
      },
    },
  },
} satisfies Prisma.storesSelect;

export type CustomerStoreListRecord = Prisma.storesGetPayload<{
  select: typeof CUSTOMER_STORE_LIST_SELECT;
}>;

export type CustomerStoreDetailRecord = Prisma.storesGetPayload<{
  select: typeof CUSTOMER_STORE_DETAIL_SELECT;
}>;
