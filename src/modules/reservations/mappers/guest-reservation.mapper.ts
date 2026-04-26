import { reservations, stores, stores as StoreModel } from '@prisma/client';
import { GuestReservationResponseDto } from '../dto/guest-reservation.dto';

export type GuestReservationWithStore = reservations & {
  stores?: Pick<
    stores,
    'business_name' | 'address' | 'phone_number' | 'latitude' | 'longitude'
  > | null;
};

export const toGuestReservationResponse = (
  reservation: GuestReservationWithStore,
  options: { includeAccessToken?: boolean } = {},
): GuestReservationResponseDto => ({
  id: reservation.id,
  storeId: reservation.store_id,
  customerName: reservation.customer_name,
  phoneNumber: reservation.customer_phone,
  email: reservation.customer_email,
  status: reservation.status,
  startTime: reservation.start_time,
  endTime: reservation.end_time,
  duration: reservation.duration,
  bagCount: reservation.bag_count,
  totalAmount: reservation.total_amount,
  message: reservation.message,
  storageType: reservation.requested_storage_type,
  paymentStatus: reservation.payment_status,
  ...(options.includeAccessToken ? { accessToken: reservation.qr_code } : {}),
  createdAt: reservation.created_at,
  storeName: reservation.stores?.business_name ?? '',
  storeAddress: reservation.stores?.address ?? null,
  storePhone: reservation.stores?.phone_number ?? null,
  lat: toNumberOrNull(reservation.stores?.latitude),
  lng: toNumberOrNull(reservation.stores?.longitude),
});

export const toGuestStoreName = (
  store: Pick<StoreModel, 'business_name'>,
): string => store.business_name;

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};
