import { reservations } from '@prisma/client';
import { ReservationResponseDto } from '../dto/reservation.dto';

export const toReservationResponse = (
  reservation: reservations,
): ReservationResponseDto => ({
  id: reservation.id,
  storeId: reservation.store_id,
  customerId: reservation.customer_id,
  customerName: reservation.customer_name,
  phoneNumber: reservation.customer_phone,
  email: reservation.customer_email,
  status: reservation.status,
  startTime: reservation.start_time,
  endTime: reservation.end_time,
  requestTime: reservation.request_time,
  duration: reservation.duration,
  bagCount: reservation.bag_count,
  price: reservation.total_amount,
  message: reservation.message,
  storageId: reservation.storage_id,
  storageNumber: reservation.storage_number,
  storageType: reservation.requested_storage_type,
  specialRequests: reservation.special_requests,
  paymentStatus: reservation.payment_status,
  paymentMethod: reservation.payment_method,
  createdAt: reservation.created_at,
});
