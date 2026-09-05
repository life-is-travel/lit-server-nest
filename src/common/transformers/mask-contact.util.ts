/** 전화번호 마스킹: 01012345678 → 010-****-5678 */
export const maskPhone = (phone: string): string => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(Math.max(digits.length, 3));
  const last4 = digits.slice(-4);
  if (digits.length === 10 || digits.length === 11) {
    const head = digits.slice(0, digits.length - 8);
    return `${head}-****-${last4}`;
  }
  return `****-${last4}`;
};

/** 이메일 마스킹: jaerok@gmail.com → ja****@gmail.com */
export const maskEmail = (email: string): string => {
  const trimmed = String(email ?? '').trim();
  const [local, domain] = trimmed.split('@');
  if (!domain) return trimmed.includes('*') ? trimmed : '***';
  if (local.length <= 2) return `${local[0] || ''}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
};

/** 리뷰 작성자 표시용 — 전화 우선, 없으면 이메일. 항상 * 마스킹 포함. */
export const maskReviewAuthorDisplay = (input: {
  phone?: string | null;
  email?: string | null;
  fallback?: string | null;
}): string => {
  const phone = String(input.phone ?? '').trim();
  // landing 이메일 예약은 customer_phone에도 이메일 주소가 들어간다.
  if (phone.includes('@')) return maskEmail(phone);
  if (phone) return maskPhone(phone);

  const email = String(input.email ?? '').trim();
  if (email) return maskEmail(email);

  const fallback = String(input.fallback ?? '').trim();
  if (!fallback) return 'G***t';
  if (fallback.includes('*')) return fallback;
  if (fallback.includes('@')) return maskEmail(fallback);
  if (/^\+?\d[\d\s-]{6,}$/.test(fallback)) return maskPhone(fallback);

  return fallback;
};
