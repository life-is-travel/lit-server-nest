import { ForbiddenException } from '@nestjs/common';
import { reservations_status } from '@prisma/client';
import { DashboardController } from '../dashboard/dashboard.controller';
import { ReservationsController } from '../reservations/reservations.controller';
import { StoresController } from '../stores/stores.controller';

const OWNER = {
  storeId: 'store_1',
  email: 'o@example.com',
  role: 'owner' as const,
  type: 'access' as const,
};
const STAFF = {
  storeId: 'store_1',
  staffId: 'staff_1',
  role: 'staff' as const,
  type: 'access' as const,
};

describe('직원 응답 가리기·상태 제한이 컨트롤러에 연결되어 있다', () => {
  it('dashboard summary/realtime hide revenue for staff only', async () => {
    const summaryService = {
      getSummary: jest.fn().mockResolvedValue({
        totalRevenue: 1,
        todayRevenue: 2,
        todayReservations: 3,
      }),
    };
    const realtimeService = {
      getRealtime: jest
        .fn()
        .mockResolvedValue({ todayRevenue: 2, activeReservations: 1 }),
    };
    const controller = new DashboardController(
      summaryService as never,
      {} as never,
      realtimeService as never,
    );

    await expect(
      controller.getSummary('store_1', STAFF),
    ).resolves.toMatchObject({
      totalRevenue: null,
      todayRevenue: null,
      todayReservations: 3,
    });
    await expect(
      controller.getRealtime('store_1', STAFF),
    ).resolves.toMatchObject({
      todayRevenue: null,
      activeReservations: 1,
    });
    await expect(
      controller.getSummary('store_1', OWNER),
    ).resolves.toMatchObject({
      totalRevenue: 1,
    });
  });

  it('store profile hides owner private fields for staff', async () => {
    const storesService = {
      getProfile: jest.fn().mockResolvedValue({
        id: 'store_1',
        email: 'o@example.com',
        phoneNumber: '010',
      }),
    };
    const controller = new StoresController(
      storesService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.getProfile('store_1', STAFF),
    ).resolves.toMatchObject({
      email: null,
      phoneNumber: null,
    });
    await expect(
      controller.getProfile('store_1', OWNER),
    ).resolves.toMatchObject({
      email: 'o@example.com',
    });
  });

  it('reservation status API refuses rejected/cancelled from staff before touching data', () => {
    const commandService = {
      normalizeStatus: jest.fn(
        (status: string) => status as reservations_status,
      ),
      updateReservationStatus: jest.fn(),
    };
    const controller = new ReservationsController(
      {} as never,
      commandService as never,
      {} as never,
      {} as never,
    );

    let error: unknown;
    try {
      controller.updateReservationStatus(
        'store_1',
        'res_1',
        { status: 'cancelled' },
        STAFF,
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'OWNER_ONLY',
    });
    expect(commandService.updateReservationStatus).not.toHaveBeenCalled();

    controller.updateReservationStatus(
      'store_1',
      'res_1',
      { status: 'cancelled' },
      OWNER,
    );
    expect(commandService.updateReservationStatus).toHaveBeenCalledWith(
      'store_1',
      'res_1',
      'cancelled',
    );
  });
});
