import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';

const SPECIAL_DAY_API_URL =
  'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 10_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface HolidayItem {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

export interface SyncResult {
  skipped: boolean;
  years: number[];
  upserted: number;
}

/** 문자열·숫자만 문자열로 바꾼다. 그 외(객체 등)는 빈 문자열 */
const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * 한국천문연구원 특일 정보(getRestDeInfo) 응답에서 공휴일(isHoliday=Y)만 뽑는다.
 *
 * 공공데이터포털 게이트웨이는 항목이 1개면 item이 객체, 여러 개면 배열이고,
 * 결과가 없으면 items가 빈 문자열로 오는 등 형태가 일정하지 않아 모두 받아 준다.
 */
export const parseSpecialDayResponse = (
  json: unknown,
): { items: HolidayItem[]; totalCount: number } => {
  const response =
    isRecord(json) && isRecord(json.response) ? json.response : json;
  const header = isRecord(response) ? response.header : undefined;
  const body = isRecord(response) ? response.body : undefined;

  if (isRecord(header) && header.resultCode !== undefined) {
    const code = asText(header.resultCode);
    if (code !== '00') {
      throw new Error(
        `특일 API 오류 resultCode=${code} ${asText(header.resultMsg)}`,
      );
    }
  }

  const container = isRecord(body) ? body : response;
  const itemsNode = isRecord(container) ? container.items : undefined;

  let rawItems: unknown[] = [];
  if (Array.isArray(itemsNode)) {
    rawItems = itemsNode;
  } else if (isRecord(itemsNode)) {
    const item = itemsNode.item;
    rawItems = Array.isArray(item) ? item : item ? [item] : [];
  }

  const items: HolidayItem[] = [];
  for (const raw of rawItems) {
    if (!isRecord(raw) || asText(raw.isHoliday) !== 'Y') continue;

    const locdate = asText(raw.locdate);
    if (!/^\d{8}$/.test(locdate)) continue;

    items.push({
      date: `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`,
      name: asText(raw.dateName).trim().slice(0, 100) || '공휴일',
    });
  }

  const total = isRecord(container) ? Number(container.totalCount) : NaN;
  return { items, totalCount: Number.isFinite(total) ? total : items.length };
};

/**
 * 공휴일을 공공데이터포털 특일 정보 API에서 받아 public_holidays에 반영한다.
 *
 * - DATA_GO_KR_SERVICE_KEY가 없으면 동기화를 건너뛴다(마이그레이션 시드 값으로 계속 동작).
 * - 추가·갱신만 한다. 사람이 SQL로 넣은 임시공휴일을 지우지 않는다.
 * - 실패해도 서버 동작에는 영향이 없고, 다음 주기에 다시 시도한다.
 */
@Injectable()
export class PublicHolidaysSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PublicHolidaysSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** 서버 시작 직후 한 번 동기화한다. 기동을 막지 않도록 기다리지 않는다. */
  onApplicationBootstrap(): void {
    void this.handleCron();
  }

  /** 매주 월요일 새벽 4시(KST). 새 연도 데이터와 임시공휴일 지정이 반영된다. */
  @Cron('0 4 * * 1', { timeZone: 'Asia/Seoul' })
  async handleCron(): Promise<void> {
    try {
      const result = await this.syncCurrentAndNextYear();
      if (!result.skipped) {
        this.logger.log({
          event: 'public_holidays.synced',
          years: result.years,
          upserted: result.upserted,
        });
      }
    } catch (err: unknown) {
      this.logger.error('공휴일 동기화 실패', err);
    }
  }

  async syncCurrentAndNextYear(now: Date = new Date()): Promise<SyncResult> {
    const serviceKey = this.configService.get<string>('DATA_GO_KR_SERVICE_KEY');
    if (!serviceKey) {
      this.logger.warn(
        'DATA_GO_KR_SERVICE_KEY가 없어 공휴일 동기화를 건너뜁니다(시드 값 사용).',
      );
      return { skipped: true, years: [], upserted: 0 };
    }

    const kstYear = new Date(now.getTime() + KST_OFFSET_MS).getUTCFullYear();
    const years = [kstYear, kstYear + 1];

    let upserted = 0;
    for (const year of years) {
      const items = await this.fetchYear(serviceKey, year);
      for (const item of items) {
        const date = new Date(`${item.date}T00:00:00.000Z`);
        await this.prisma.public_holidays.upsert({
          where: { date },
          create: { date, name: item.name },
          update: { name: item.name },
        });
        upserted += 1;
      }
    }

    return { skipped: false, years, upserted };
  }

  private async fetchYear(
    serviceKey: string,
    year: number,
  ): Promise<HolidayItem[]> {
    // 포털은 Encoding/Decoding 두 가지 키를 발급한다. 이미 인코딩된 키(%포함)면 풀어서 다시 인코딩한다.
    const key = encodeURIComponent(
      serviceKey.includes('%') ? decodeURIComponent(serviceKey) : serviceKey,
    );

    const collected: HolidayItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url =
        `${SPECIAL_DAY_API_URL}?serviceKey=${key}&solYear=${year}` +
        `&numOfRows=${PAGE_SIZE}&pageNo=${page}&_type=json`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`특일 API HTTP ${res.status} (year=${year})`);
      }

      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        // 인증키 오류 등은 JSON이 아닌 XML로 내려오는 경우가 있다
        throw new Error(
          `특일 API가 JSON이 아닌 응답을 반환했습니다: ${text.slice(0, 200)}`,
        );
      }

      const { items, totalCount } = parseSpecialDayResponse(json);
      collected.push(...items);

      if (page * PAGE_SIZE >= totalCount) break;
    }

    return collected;
  }
}
