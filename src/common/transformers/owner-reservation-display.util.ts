/** 점주 화면용 예약 고객 표시 — 실명 대신 연락처(한국: 전화, 외국 이메일 예약: 메일). */
export const ownerReservationDisplayLabel = (input: {
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
}): string => {
  const phone = String(input.phone ?? '').trim();
  const email = String(input.email ?? '').trim();

  if (phone.includes('@')) return phone;
  if (email && !phone) return email;
  if (phone) return phone;
  if (email) return email;

  const name = String(input.customerName ?? '').trim();
  return name || '고객';
};
