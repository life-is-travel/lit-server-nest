import { toCustomerStoreResponse } from './customer-store.mapper';
import { CustomerStoreDetailRecord } from '../services/customer-stores.select';

const baseRecord = {
  id: 'store-1',
  slug: 'test-store',
  business_name: '테스트 미용실',
  description: null,
  phone_number: '010-0000-0000',
  store_phone_number: null,
  notification_phone: null,
  address: '서울시 어딘가',
  latitude: null,
  longitude: null,
  business_type: 'BEAUTY_SALON',
  store_operating_hours: null,
  store_settings: null,
  reviews: [],
  _count: { reservations: 0 },
} as unknown as CustomerStoreDetailRecord;

describe('toCustomerStoreResponse', () => {
  it('businessType을 응답에 포함한다', () => {
    const result = toCustomerStoreResponse(baseRecord);
    expect(result.businessType).toBe('BEAUTY_SALON');
  });

  it('business_type이 null이면 businessType도 null이다', () => {
    const record = {
      ...baseRecord,
      business_type: null,
    } as unknown as CustomerStoreDetailRecord;
    expect(toCustomerStoreResponse(record).businessType).toBeNull();
  });

  it('리뷰 customerName을 예약 연락처 기준으로 마스킹한다', () => {
    const record = {
      ...baseRecord,
      reviews: [
        {
          id: 'review_1',
          store_id: 'store-1',
          customer_id: 'customer_1',
          customer_name: 'G***t',
          reservation_id: 'res_1',
          storage_id: null,
          storage_number: null,
          type: 'store',
          rating: 5,
          service_rating: null,
          comment: '좋아요',
          images: null,
          status: 'pending',
          response: null,
          response_date: null,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
          reservations: {
            customer_phone: '01098765432',
            customer_email: 'guest@example.com',
          },
        },
      ],
    } as unknown as CustomerStoreDetailRecord;

    const result = toCustomerStoreResponse(record);

    expect(result.reviews[0]?.customerName).toBe('010-****-5432');
    expect(result.reviews[0]).not.toHaveProperty('reservations');
  });
});
