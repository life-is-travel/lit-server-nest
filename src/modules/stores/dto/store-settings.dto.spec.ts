import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateStoreSettingsDto } from './store-settings.dto';

describe('UpdateStoreSettingsDto', () => {
  const validateDto = (payload: unknown) => {
    const dto = plainToInstance(UpdateStoreSettingsDto, payload, {
      enableImplicitConversion: true,
    });

    return validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  };

  it('accepts store settings response fields when saving settings back', async () => {
    const errors = await validateDto({
      operationSettings: {
        operatingDays: {
          월: true,
          화: true,
          수: true,
          목: true,
          금: true,
          토: true,
          일: false,
        },
        openTime: '9:0',
        closeTime: '22:0',
        dailyHours: {
          월: {
            openTime: '9:0',
            closeTime: '22:0',
            isOperating: true,
          },
          화: { openTime: '09:00:00', closeTime: '22:00', isOperating: true },
          수: {
            openTime: '1970-01-01T09:00:00.000Z',
            closeTime: '22:00',
            isOperating: true,
          },
          목: { openTime: '09:00', closeTime: '', isOperating: true },
          금: { openTime: '09:00', closeTime: null, isOperating: true },
          토: { openTime: '', closeTime: '', isOperating: true },
          일: { openTime: null, closeTime: null, isOperating: false },
        },
      },
      storageSettings: {
        extraSmall: { description: '초소형', hourlyRate: 1000 },
        small: { description: '소형', hourlyRate: 2000 },
        medium: { description: '중형', hourlyRate: 3000 },
        large: { description: '대형', hourlyRate: 4000 },
        special: { description: '특수', hourlyRate: 5000 },
      },
      categories: [
        { id: 'wine-bar', name: '와인바', enabled: true },
        { id: 'luggage-storage', name: '짐보관', enabled: true },
      ],
    });

    expect(errors).toHaveLength(0);
  });
});
