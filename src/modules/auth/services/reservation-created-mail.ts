/**
 * 예약 생성 확인 메일(F-020) — 제목·글자 본문·HTML 본문을 만든다. 발송은 MailService.
 *
 * HTML은 메일 앱 호환을 위해 표(table) 배치 + 인라인 스타일만 쓴다(<style>·flex 금지:
 * Gmail 일부·Outlook이 지운다). 매장 외국어 표기는 서버에 없으므로 한글 상호·주소를 그대로 쓰고,
 * 외국어 메일에는 "택시 기사에게 이 주소를" 안내와 랜딩 매장 페이지 링크를 붙인다.
 */

export type ReservationMailLocale = 'ko' | 'en' | 'ja' | 'zh';

export type ReservationMailItem = {
  storageType: string;
  bagCount: number;
};

export type ReservationMailStore = {
  name: string;
  address?: string | null;
  detailAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
};

export type ReservationCreatedMailContext = {
  reservationId: string;
  customerName: string;
  locale?: string | null;
  /** 매장 정보가 없을 때만 쓰는 상호(레거시 호출부 호환) */
  storeName?: string | null;
  store?: ReservationMailStore | null;
  startTime: Date;
  endTime?: Date | null;
  bagCount: number;
  totalAmount: number;
  items?: ReservationMailItem[] | null;
  /** 매장에 사용 중인 매장 혜택 쿠폰 정책이 있으면 쿠폰 칸을 넣는다 */
  hasStoreCoupon?: boolean;
  couponValidityDays?: number | null;
  accessToken?: string | null;
};

export type BuiltMail = { subject: string; text: string; html: string };

const SITE = 'https://www.lifeistravel.io';
const FONT =
  "-apple-system,'Apple SD Gothic Neo','Hiragino Sans','PingFang SC','Malgun Gothic',Arial,sans-serif";

const INTL_LOCALE: Record<ReservationMailLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

type Copy = {
  subject: string;
  badge: string;
  heading: string;
  reservationNo: string;
  showNumber: string;
  store: string;
  storePage: string;
  address: string;
  taxiHint: string | null;
  when: string;
  luggage: string;
  payAtStore: (amount: string) => string;
  sizes: Record<string, string>;
  unit: (count: number) => string;
  kst: string;
  tbd: string;
  couponLabel: string;
  couponTitle: string;
  couponValid: (days: number) => string;
  couponButton: string;
  mapGoogle: string;
  mapNaver: string;
  lookup: string;
  freeCancel: string;
  compensation: string;
  fallbackStoreName: string;
};

const COPY: Record<ReservationMailLocale, Copy> = {
  ko: {
    subject: '예약 완료',
    badge: '예약 완료',
    heading: '짐 맡길 곳이 예약됐어요.',
    reservationNo: '예약 번호',
    showNumber: '매장에서 이 번호를 보여 주세요',
    store: '매장',
    storePage: '매장 정보 보기',
    address: '주소',
    taxiHint: null,
    when: '맡기는 시간 · 찾는 시간',
    luggage: '짐',
    payAtStore: (a) => a + ' · 매장에서 현장 결제 (현금·카드)',
    sizes: {
      s: '소형',
      m: '중형',
      l: '대형',
      xl: '대형',
      special: '특수',
      refrigeration: '냉장',
    },
    unit: (n) => n + '개',
    kst: '',
    tbd: '미정',
    couponLabel: '이 매장 혜택',
    couponTitle: '짐을 맡긴 손님에게 쿠폰을 드려요',
    couponValid: (d) => '짐을 맡긴 날부터 ' + d + '일 동안 사용할 수 있어요',
    couponButton: '🎟 쿠폰 사용하기',
    mapGoogle: 'Google 지도에서 보기',
    mapNaver: '📍 네이버 지도에서 보기',
    lookup: '예약 조회·취소',
    freeCancel: '짐을 맡기기 전까지 무료로 취소할 수 있어요.',
    compensation: '분실·파손 시 LIT가 최대 ₩500,000까지 보상해요.',
    fallbackStoreName: 'LIT 제휴 매장',
  },
  en: {
    subject: 'Reservation confirmed',
    badge: 'Reservation confirmed',
    heading: 'Your bag spot is booked.',
    reservationNo: 'Reservation No.',
    showNumber: 'Show this number at the store',
    store: 'Store',
    storePage: 'View store page',
    address: 'Address',
    taxiHint: 'Show this Korean address to a taxi driver',
    when: 'Drop-off & pick-up',
    luggage: 'Luggage',
    payAtStore: (a) => a + ' · pay at the store (cash or card)',
    sizes: {
      s: 'Small bag',
      m: 'Medium suitcase',
      l: 'Large suitcase',
      xl: 'Large suitcase',
      special: 'Special item',
      refrigeration: 'Refrigerated item',
    },
    unit: (n) => '× ' + n,
    kst: ' (KST)',
    tbd: 'TBD',
    couponLabel: 'BONUS AT THIS STORE',
    couponTitle: 'This store gives a coupon to LIT luggage customers',
    couponValid: (d) => 'Valid for ' + d + ' days from drop-off',
    couponButton: '🎟 Use coupon',
    mapGoogle: '📍 Open in Google Maps',
    mapNaver: 'Open in Naver Map',
    lookup: 'View or cancel reservation',
    freeCancel: 'Free cancellation until you drop off your bags.',
    compensation: 'Loss or damage covered by LIT up to ₩500,000.',
    fallbackStoreName: 'LIT partner store',
  },
  ja: {
    subject: '予約完了',
    badge: '予約完了',
    heading: '荷物の預け先を予約しました。',
    reservationNo: '予約番号',
    showNumber: 'お店でこの番号を見せてください',
    store: '店舗',
    storePage: '店舗ページを見る',
    address: '住所',
    taxiHint: 'タクシーでは韓国語の住所を見せてください',
    when: '預け・受け取り',
    luggage: '荷物',
    payAtStore: (a) => a + '・お店でお支払い（現金・カード）',
    sizes: {
      s: '小型',
      m: '中型スーツケース',
      l: '大型スーツケース',
      xl: '大型スーツケース',
      special: '特殊',
      refrigeration: '冷蔵',
    },
    unit: (n) => '× ' + n,
    kst: '（韓国時間）',
    tbd: '未定',
    couponLabel: 'このお店の特典',
    couponTitle: '荷物を預けたお客様にクーポンをご用意しています',
    couponValid: (d) => '預けた日から' + d + '日間有効',
    couponButton: '🎟 クーポンを使う',
    mapGoogle: '📍 Googleマップで開く',
    mapNaver: 'NAVERマップで開く',
    lookup: '予約の確認・キャンセル',
    freeCancel: '荷物を預けるまでは無料でキャンセルできます。',
    compensation: '紛失・破損はLITが最大₩500,000まで補償します。',
    fallbackStoreName: 'LIT提携店舗',
  },
  zh: {
    subject: '预约成功',
    badge: '预约成功',
    heading: '行李寄存已预约。',
    reservationNo: '预约编号',
    showNumber: '到店时请出示此编号',
    store: '门店',
    storePage: '查看门店页面',
    address: '地址',
    taxiHint: '打车时请向司机出示韩文地址',
    when: '寄存・取件',
    luggage: '行李',
    payAtStore: (a) => a + '・到店付款（现金或银行卡）',
    sizes: {
      s: '小型',
      m: '中型行李箱',
      l: '大型行李箱',
      xl: '大型行李箱',
      special: '特殊',
      refrigeration: '冷藏',
    },
    unit: (n) => '× ' + n,
    kst: '（韩国时间）',
    tbd: '待定',
    couponLabel: '本店专属优惠',
    couponTitle: '本店为寄存行李的LIT顾客提供优惠券',
    couponValid: (d) => '自寄存当天起' + d + '天内有效',
    couponButton: '🎟 使用优惠券',
    mapGoogle: '在谷歌地图中打开',
    mapNaver: '📍 在Naver地图中打开',
    lookup: '查看或取消预约',
    freeCancel: '寄存行李之前可免费取消。',
    compensation: '如有丢失或损坏，LIT最高赔偿₩500,000。',
    fallbackStoreName: 'LIT合作门店',
  },
};

export function resolveReservationMailLocale(
  locale?: string | null,
): ReservationMailLocale {
  return locale === 'en' || locale === 'ja' || locale === 'zh' ? locale : 'ko';
}

/** 랜딩 예약 완료 화면(shortReservationCode)과 같은 규칙: 마지막 '-' 뒤 끝 6자리 대문자 */
export function shortReservationCode(id: string): string {
  if (!id) return '';
  const lastDash = id.lastIndexOf('-');
  const tail = lastDash >= 0 ? id.slice(lastDash + 1) : id;
  return tail.slice(-6).toUpperCase();
}

function localePrefix(locale: ReservationMailLocale): string {
  return locale === 'ko' ? '' : '/' + locale;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function kstDayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDay(date: Date, locale: ReservationMailLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function formatShortDay(date: Date, locale: ReservationMailLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'Asia/Seoul',
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
  }).format(date);
}

function formatTime(date: Date, locale: ReservationMailLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatReservationWhen(
  start: Date,
  end: Date | null | undefined,
  locale: ReservationMailLocale,
): string {
  const c = COPY[locale];
  const startDay = formatDay(start, locale);
  const startTime = formatTime(start, locale);
  if (!end) return startDay + ' · ' + startTime + ' ~ ' + c.tbd + c.kst;
  if (kstDayKey(start) === kstDayKey(end)) {
    return (
      startDay + ' · ' + startTime + ' ~ ' + formatTime(end, locale) + c.kst
    );
  }
  return (
    startDay +
    ' ' +
    startTime +
    ' ~ ' +
    formatDay(end, locale) +
    ' ' +
    formatTime(end, locale) +
    c.kst
  );
}

function formatLuggage(
  ctx: ReservationCreatedMailContext,
  locale: ReservationMailLocale,
): string {
  const c = COPY[locale];
  const items = (ctx.items ?? []).filter((i) => i.bagCount > 0);
  if (items.length === 0) {
    const label =
      locale === 'ko'
        ? '짐 ' + ctx.bagCount + '개'
        : c.luggage + ' ' + c.unit(ctx.bagCount);
    return label;
  }
  return items
    .map((i) => {
      const label = c.sizes[i.storageType] ?? i.storageType;
      return locale === 'ko'
        ? label + ' ' + c.unit(i.bagCount)
        : label + ' ' + c.unit(i.bagCount);
    })
    .join(', ');
}

function formatWon(amount: number): string {
  return '₩' + amount.toLocaleString('en-US');
}

type Links = {
  google: string | null;
  naver: string | null;
  storePage: string | null;
  lookup: string;
  coupons: string;
};

function buildLinks(
  email: string,
  ctx: ReservationCreatedMailContext,
  locale: ReservationMailLocale,
): Links {
  const store = ctx.store;
  const address = store?.address?.trim() || null;
  const hasCoords =
    typeof store?.latitude === 'number' &&
    typeof store?.longitude === 'number' &&
    Number.isFinite(store.latitude) &&
    Number.isFinite(store.longitude);
  const google = hasCoords
    ? 'https://www.google.com/maps/search/?api=1&query=' +
      store.latitude +
      ',' +
      store.longitude
    : address
      ? 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(address)
      : null;
  const naver = address
    ? 'https://map.naver.com/p/search/' + encodeURIComponent(address)
    : null;
  const prefix = localePrefix(locale);
  const query = '?email=' + encodeURIComponent(email);
  return {
    google,
    naver,
    storePage: store?.slug
      ? SITE + prefix + '/stores/' + encodeURIComponent(store.slug)
      : null,
    lookup: SITE + prefix + '/reservations' + query,
    coupons: SITE + prefix + '/coupons' + query,
  };
}

/** 언어별 지도 버튼 — ko: 네이버, en·ja: Google, zh: 네이버 + Google (중국 본토는 Google이 막힐 수 있음) */
function mapButtons(
  links: Links,
  locale: ReservationMailLocale,
): Array<{ href: string; label: string; primary: boolean }> {
  const c = COPY[locale];
  const naver = links.naver ? { href: links.naver, label: c.mapNaver } : null;
  const google = links.google
    ? { href: links.google, label: c.mapGoogle }
    : null;
  const ordered =
    locale === 'ko' ? [naver] : locale === 'zh' ? [naver, google] : [google];
  const present = ordered.filter(
    (b): b is { href: string; label: string } => b !== null,
  );
  if (present.length === 0 && (google || naver))
    present.push((google ?? naver)!);
  return present.map((b, i) => ({ ...b, primary: i === 0 }));
}

export function buildReservationCreatedMail(
  email: string,
  ctx: ReservationCreatedMailContext,
): BuiltMail {
  const locale = resolveReservationMailLocale(ctx.locale);
  const c = COPY[locale];
  const storeName =
    ctx.store?.name?.trim() || ctx.storeName?.trim() || c.fallbackStoreName;
  const fullAddress = [
    ctx.store?.address?.trim(),
    ctx.store?.detailAddress?.trim(),
  ]
    .filter(Boolean)
    .join(' ');
  const code = shortReservationCode(ctx.reservationId);
  const when = formatReservationWhen(ctx.startTime, ctx.endTime, locale);
  const luggage = formatLuggage(ctx, locale);
  const pay = c.payAtStore(formatWon(ctx.totalAmount));
  const links = buildLinks(email, ctx, locale);
  const maps = mapButtons(links, locale);
  const validityDays =
    ctx.couponValidityDays && ctx.couponValidityDays > 0
      ? ctx.couponValidityDays
      : 7;

  const subject =
    '[LIT] ' +
    c.subject +
    (locale === 'ko' ? ' · ' + storeName : '') +
    ' · ' +
    formatShortDay(ctx.startTime, locale);

  // ---- 글자 버전 (HTML을 못 여는 메일 앱용) ----
  const textLines: string[] = [
    c.heading,
    '',
    c.reservationNo + ': ' + code,
    c.showNumber,
    '',
    c.store + ': ' + storeName,
  ];
  if (links.storePage) textLines.push(c.storePage + ': ' + links.storePage);
  if (fullAddress) {
    textLines.push(c.address + ': ' + fullAddress);
    if (c.taxiHint) textLines.push('(' + c.taxiHint + ')');
  }
  textLines.push(c.when + ': ' + when, c.luggage + ': ' + luggage, pay, '');
  if (ctx.hasStoreCoupon) {
    textLines.push(
      '[' +
        c.couponLabel +
        '] ' +
        c.couponTitle +
        ' — ' +
        c.couponValid(validityDays),
      c.couponButton.replace('🎟 ', '') + ': ' + links.coupons,
      '',
    );
  }
  for (const m of maps)
    textLines.push(m.label.replace('📍 ', '') + ': ' + m.href);
  textLines.push(
    c.lookup + ': ' + links.lookup,
    '',
    '- ' + c.freeCancel,
    '- ' + c.compensation,
    '',
    'Life is Travel · contact@lifeistravel.io',
  );
  const text = textLines.join('\n');

  // ---- HTML 버전 ----
  const e = escapeHtml;
  const cell = (th: string, td: string, first: boolean) => {
    const border = first ? '' : 'border-top:1px solid #eeeeee;';
    return (
      '<tr><td valign="top" width="92" style="padding:10px 8px 10px 0;' +
      border +
      'font-family:' +
      FONT +
      ';font-size:12px;color:#777777">' +
      th +
      '</td><td valign="top" style="padding:10px 0;' +
      border +
      'font-family:' +
      FONT +
      ';font-size:14px;color:#1a1a1a;line-height:1.45">' +
      td +
      '</td></tr>'
    );
  };
  const hint = (s: string) =>
    '<div style="font-size:12px;color:#888888;margin-top:3px">' + s + '</div>';
  const button = (
    href: string,
    label: string,
    kind: 'primary' | 'secondary' | 'coupon',
  ) => {
    const bg =
      kind === 'primary'
        ? '#1F6BD4'
        : kind === 'coupon'
          ? '#F5B800'
          : '#ffffff';
    const border =
      kind === 'primary'
        ? '#1F6BD4'
        : kind === 'coupon'
          ? '#F5B800'
          : '#d6d6d6';
    const color = kind === 'primary' ? '#ffffff' : '#1a1a1a';
    return (
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px"><tr><td align="center" bgcolor="' +
      bg +
      '" style="border-radius:10px;border:1px solid ' +
      border +
      '">' +
      '<a href="' +
      e(href) +
      '" target="_blank" style="display:block;padding:13px 12px;font-family:' +
      FONT +
      ';font-size:15px;font-weight:700;color:' +
      color +
      ';text-decoration:none">' +
      e(label) +
      '</a></td></tr></table>'
    );
  };

  const storeCell =
    '<b>' +
    e(storeName) +
    '</b>' +
    (links.storePage
      ? '<div style="margin-top:3px"><a href="' +
        e(links.storePage) +
        '" target="_blank" style="font-size:12px;color:#1F6BD4;text-decoration:none">' +
        e(c.storePage) +
        ' ›</a></div>'
      : '');
  const rows = [cell(e(c.store), storeCell, true)];
  if (fullAddress)
    rows.push(
      cell(
        e(c.address),
        e(fullAddress) + (c.taxiHint ? hint(e(c.taxiHint)) : ''),
        false,
      ),
    );
  rows.push(cell(e(c.when), e(when), false));
  rows.push(cell(e(c.luggage), e(luggage) + hint(e(pay)), false));

  const coupon = ctx.hasStoreCoupon
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px"><tr><td bgcolor="#FFF6DB" style="border:1px solid #F2D27A;border-radius:12px;padding:14px 16px">' +
      '<div style="font-family:' +
      FONT +
      ';font-size:11px;font-weight:700;letter-spacing:1px;color:#9A6B00">' +
      e(c.couponLabel) +
      '</div>' +
      '<div style="font-family:' +
      FONT +
      ';font-size:16px;font-weight:800;color:#1a1a1a;margin:4px 0 2px">' +
      e(c.couponTitle) +
      '</div>' +
      '<div style="font-family:' +
      FONT +
      ';font-size:12px;color:#9A6B00">' +
      e(c.couponValid(validityDays)) +
      '</div>' +
      button(links.coupons, c.couponButton, 'coupon') +
      '</td></tr></table>'
    : '';

  const html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f1efea">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1efea"><tr><td align="center" style="padding:20px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:14px"><tr><td style="padding:24px 22px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="font-family:' +
    FONT +
    ';font-size:22px;font-weight:800;color:#1F6BD4;letter-spacing:1px">LIT</td>' +
    '<td align="right"><span style="display:inline-block;background:#e8f0fc;color:#164FA3;font-family:' +
    FONT +
    ';font-size:12px;font-weight:700;padding:5px 10px;border-radius:99px">✓ ' +
    e(c.badge) +
    '</span></td>' +
    '</tr></table>' +
    '<div style="font-family:' +
    FONT +
    ';font-size:19px;font-weight:700;color:#1a1a1a;margin:18px 0 14px">' +
    e(c.heading) +
    '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#f5f8fe" style="border:1px dashed #9ab8e8;border-radius:12px;padding:14px">' +
    '<div style="font-family:' +
    FONT +
    ';font-size:11px;letter-spacing:2px;color:#666666;font-weight:600">' +
    e(c.reservationNo) +
    '</div>' +
    '<div style="font-family:Menlo,Consolas,\'Courier New\',monospace;font-size:38px;font-weight:700;letter-spacing:5px;color:#1a1a1a;margin:4px 0">' +
    e(code) +
    '</div>' +
    '<div style="font-family:' +
    FONT +
    ';font-size:12px;color:#164FA3;font-weight:600">' +
    e(c.showNumber) +
    '</div>' +
    '</td></tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">' +
    rows.join('') +
    '</table>' +
    coupon +
    maps
      .map((m) => button(m.href, m.label, m.primary ? 'primary' : 'secondary'))
      .join('') +
    button(links.lookup, c.lookup, 'secondary') +
    '<div style="font-family:' +
    FONT +
    ';font-size:12.5px;color:#555555;line-height:1.7;margin-top:16px">• ' +
    e(c.freeCancel) +
    '<br>• ' +
    e(c.compensation) +
    '</div>' +
    '<div style="font-family:' +
    FONT +
    ';font-size:11px;color:#aaaaaa;margin-top:16px;border-top:1px solid #eeeeee;padding-top:10px">Life is Travel · contact@lifeistravel.io · lifeistravel.io</div>' +
    '</td></tr></table></td></tr></table></body></html>';

  return { subject, text, html };
}
