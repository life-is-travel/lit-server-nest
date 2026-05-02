import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth/dto/register.dto';
import { CustomerSocialLoginDto } from './customer-auth/dto/customer-auth.dto';
import { CreateCouponPolicyDto } from './coupons/dto/coupon.dto';
import {
  CreateGuestReservationDto,
  GuestAvailabilityQueryDto,
} from './reservations/dto/guest-reservation.dto';
import {
  CreateReservationDto,
  StoreCheckinDto,
} from './reservations/dto/reservation.dto';
import { UpdateStorageDto } from './storages/dto/storage.dto';
import { UpdateStoreProfileDto } from './stores/dto/store-profile.dto';

const validateDto = async <T extends object>(
  dtoClass: new () => T,
  payload: unknown,
) => {
  const dto = plainToInstance(dtoClass, payload, {
    enableImplicitConversion: true,
  });

  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
};

describe('legacy payload compatibility', () => {
  it('accepts numeric strings and relative upload paths in reservation payloads', async () => {
    const errors = await validateDto(CreateReservationDto, {
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '01012345678',
      email: '',
      startTime: '2026-05-02T09:00:00.000Z',
      endTime: '',
      duration: '4',
      bagCount: '2',
      price: '',
      luggageImageUrls: ['/uploads/reservations/photo.jpg'],
      requestTime: '',
      storageType: 's',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts guest reservation and availability numeric query strings', async () => {
    const reservationErrors = await validateDto(CreateGuestReservationDto, {
      storeId: 'store_1',
      customerName: '홍길동',
      phoneNumber: '01012345678',
      email: '',
      customerEmail: '',
      startTime: '2026-05-02T09:00:00.000Z',
      endTime: '',
      duration: '4',
      bagCount: '2',
      requestedStorageType: 's',
    });

    const availabilityErrors = await validateDto(GuestAvailabilityQueryDto, {
      storeId: 'store_1',
      startTime: '2026-05-02T09:00:00.000Z',
      duration: '4',
    });

    expect(reservationErrors).toHaveLength(0);
    expect(availabilityErrors).toHaveLength(0);
  });

  it('accepts storage numeric strings', async () => {
    const errors = await validateDto(UpdateStorageDto, {
      number: 'S1',
      type: 's',
      status: 'available',
      width: '10',
      height: '20',
      depth: '30',
      pricing: '2000',
      floor: '1',
      row: '2',
      column: '3',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts string booleans and relative profile images for auth/profile payloads', async () => {
    const registerErrors = await validateDto(RegisterDto, {
      email: 'store@example.com',
      password: 'password123',
      businessName: '테스트 매장',
      wantsSmsNotification: 'false',
      latitude: '37.529',
      longitude: '126.968',
    });

    const customerErrors = await validateDto(CustomerSocialLoginDto, {
      provider: 'kakao',
      profileImage: '/uploads/profile.png',
      birthDate: '',
      termsAgreed: 'true',
      privacyAgreed: '1',
      locationAgreed: 'false',
      marketingAgreed: '0',
    });

    const profileErrors = await validateDto(UpdateStoreProfileDto, {
      profileImageUrl: '/uploads/store.png',
      wantsSmsNotification: 'false',
      hasCompletedSetup: 'true',
      latitude: '37.529',
      longitude: '126.968',
    });

    expect(registerErrors).toHaveLength(0);
    expect(customerErrors).toHaveLength(0);
    expect(profileErrors).toHaveLength(0);
  });

  it('accepts coupon policy empty numeric fields and string enabled flags', async () => {
    const errors = await validateDto(CreateCouponPolicyDto, {
      name: '가입 쿠폰',
      type: 'payment_discount',
      discountAmount: '1000',
      discountRate: '',
      minSpend: '',
      maxDiscount: '',
      validityDays: '7',
      enabled: 'false',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts relative checkin photo paths', async () => {
    const errors = await validateDto(StoreCheckinDto, {
      photoUrls: ['/uploads/checkin/photo.jpg'],
    });

    expect(errors).toHaveLength(0);
  });
});

