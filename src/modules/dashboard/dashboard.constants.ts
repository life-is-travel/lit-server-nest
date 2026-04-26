import { reservations_status } from '@prisma/client';

export const ACTIVE_RESERVATION_STATUSES = [
  reservations_status.confirmed,
  reservations_status.in_progress,
];
