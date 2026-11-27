import {
  buildReservationCreatedMail,
  formatReservationWhen,
  shortReservationCode,
  type ReservationCreatedMailContext,
} from './reservation-created-mail';

const base: ReservationCreatedMailContext = {
  reservationId: 'res_530c8469-6626-4f47-8565-575b8201f43d',
  customerName: 'Guest',
  locale: 'en',
  store: {
    name: '언라인',
    address: '서울 성동구 성수이로16길 46',
    detailAddress: '1층',
    latitude: 37.5396692,
    longitude: 127.0612525,
    slug: 'unlign',
  },
  // 2026-12-01 09:00 ~ 14:30 KST
  startTime: new Date('2026-12-01T00:00:00.000Z'),
  endTime: new Date('2026-12-01T05:30:00.000Z'),
  bagCount: 1,
  totalAmount: 8000,
  items: [{ storageType: 'l', bagCount: 1 }],
};

describe('buildReservationCreatedMail', () => {
  it('uses the same short code as the landing success page', () => {
    expect(shortReservationCode(base.reservationId)).toBe('01F43D');
    expect(shortReservationCode('res_123456')).toBe('123456');
  });

  it('builds the English mail with code, Korean address, KST and links', () => {
    const mail = buildReservationCreatedMail('guest@example.com', base);

    expect(mail.subject).toBe('[LIT] Reservation confirmed · Dec 1');
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('01F43D');
      expect(body).toContain('언라인');
      expect(body).toContain('서울 성동구 성수이로16길 46 1층');
      expect(body).toContain('Show this Korean address to a taxi driver');
      expect(body).toContain('(KST)');
      expect(body).toContain('Large suitcase × 1');
      expect(body).toContain('₩8,000 · pay at the store (cash or card)');
      expect(body).toContain('Free cancellation until you drop off your bags.');
      expect(body).toContain('Loss or damage covered by LIT up to ₩500,000.');
    }
    expect(mail.text).toContain(
      'https://www.google.com/maps/search/?api=1&query=37.5396692,127.0612525',
    );
    expect(mail.text).toContain('https://www.lifeistravel.io/en/stores/unlign');
    expect(mail.text).toContain(
      'https://www.lifeistravel.io/en/reservations?email=guest%40example.com',
    );
    // 쿠폰 정책이 없으면 쿠폰 칸 없음
    expect(mail.html).not.toContain('/coupons?');
    expect(mail.text).not.toContain('Use coupon');
    // 메일 앱이 지우는 <style>·flex를 쓰지 않는다
    expect(mail.html).not.toContain('<style');
    expect(mail.html).not.toContain('display:flex');
  });

  it('adds the coupon block only when the store has a coupon policy', () => {
    const mail = buildReservationCreatedMail('guest@example.com', {
      ...base,
      hasStoreCoupon: true,
      couponValidityDays: 7,
    });

    expect(mail.html).toContain('BONUS AT THIS STORE');
    expect(mail.html).toContain('Valid for 7 days from drop-off');
    expect(mail.html).toContain(
      'https://www.lifeistravel.io/en/coupons?email=guest%40example.com',
    );
    expect(mail.text).toContain(
      'Use coupon: https://www.lifeistravel.io/en/coupons?email=guest%40example.com',
    );
  });

  it('Korean mail: store name in subject, Naver map, no locale prefix, no taxi hint', () => {
    const mail = buildReservationCreatedMail('guest@example.com', {
      ...base,
      locale: 'ko',
      hasStoreCoupon: true,
    });

    expect(mail.subject).toBe('[LIT] 예약 완료 · 언라인 · 12월 1일');
    expect(mail.text).toContain('대형 1개');
    expect(mail.text).toContain(
      'https://map.naver.com/p/search/' +
        encodeURIComponent('서울 성동구 성수이로16길 46'),
    );
    expect(mail.text).not.toContain('google.com/maps');
    expect(mail.text).toContain(
      'https://www.lifeistravel.io/reservations?email=',
    );
    expect(mail.text).toContain(
      '쿠폰 사용하기: https://www.lifeistravel.io/coupons?email=',
    );
    expect(mail.text).not.toContain('택시');
  });

  it('Chinese mail offers both Naver and Google maps', () => {
    const mail = buildReservationCreatedMail('guest@example.com', {
      ...base,
      locale: 'zh',
    });

    expect(mail.subject).toBe('[LIT] 预约成功 · 12月1日');
    expect(mail.text).toContain('map.naver.com');
    expect(mail.text).toContain('google.com/maps');
    expect(mail.text).toContain('大型行李箱 × 1');
  });

  it('Japanese mail', () => {
    const mail = buildReservationCreatedMail('guest@example.com', {
      ...base,
      locale: 'ja',
    });

    expect(mail.subject).toBe('[LIT] 予約完了 · 12月1日');
    expect(mail.text).toContain('（韓国時間）');
    expect(mail.text).toContain('google.com/maps');
    expect(mail.text).not.toContain('map.naver.com');
  });

  it('falls back to Korean for unknown locales and to the legacy store name without store info', () => {
    const mail = buildReservationCreatedMail('guest@example.com', {
      ...base,
      locale: 'fr',
      store: null,
      storeName: '빈마마파파',
      items: null,
      bagCount: 2,
    });

    expect(mail.subject).toBe('[LIT] 예약 완료 · 빈마마파파 · 12월 1일');
    expect(mail.text).toContain('짐 2개');
    expect(mail.text).not.toContain('주소:');
    expect(mail.text).not.toContain('/stores/');
  });

  it('escapes store values in HTML', () => {
    const mail = buildReservationCreatedMail('guest@example.com', {
      ...base,
      store: { ...base.store!, name: '<b>가게</b> & Co' },
    });

    expect(mail.html).toContain('&lt;b&gt;가게&lt;/b&gt; &amp; Co');
    expect(mail.html).not.toContain('<b><b>');
  });

  it('shows both dates when pick-up is on a later day', () => {
    const when = formatReservationWhen(
      new Date('2026-12-01T00:00:00.000Z'),
      new Date('2026-12-03T09:00:00.000Z'),
      'en',
    );

    expect(when).toContain('Dec 1, 2026');
    expect(when).toContain('Dec 3, 2026');
    expect(when.endsWith('(KST)')).toBe(true);
  });
});
