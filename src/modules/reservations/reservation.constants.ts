import { reservations_status } from '@prisma/client';

export const RESERVATION_LOCALES = ['ko', 'en', 'ja', 'zh'] as const;

export type ReservationLocale = (typeof RESERVATION_LOCALES)[number];

export const DEFAULT_RESERVATION_LOCALE: ReservationLocale = 'ko';

export const normalizeReservationLocale = (
  locale?: string | null,
): ReservationLocale => {
  const normalized = String(locale ?? '').trim();

  if (RESERVATION_LOCALES.includes(normalized as ReservationLocale)) {
    return normalized as ReservationLocale;
  }

  return DEFAULT_RESERVATION_LOCALE;
};

export const ACTIVE_RESERVATION_STATUSES: reservations_status[] = [
  reservations_status.confirmed,
  reservations_status.in_progress,
];

// 점주의 물리적 확인(손님 미방문)은 승인 대기 상태보다 우선한다 —
// NO_AVAILABLE_STORAGE로 pending에 남은 멤버도 함께 전이
export const NO_SHOW_FROM_STATUSES: reservations_status[] = [
  reservations_status.pending,
  reservations_status.pending_approval,
  reservations_status.confirmed,
];

export const RELEASE_STORAGE_STATUSES: reservations_status[] = [
  reservations_status.rejected,
  reservations_status.cancelled,
  reservations_status.completed,
];

export const TERMINAL_RESERVATION_STATUSES: reservations_status[] = [
  reservations_status.rejected,
  reservations_status.cancelled,
  reservations_status.completed,
];
