import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerReservationsController } from './customer-reservations.controller';
import { GuestReservationsController } from './guest-reservations.controller';
import { ReservationsController } from './reservations.controller';
import { GuestReservationService } from './services/guest-reservation.service';
import { LuggagePhotoService } from './services/luggage-photo.service';
import { QrCheckinService } from './services/qr-checkin.service';
import { ReservationCommandService } from './services/reservation-command.service';
import { ReservationNoShowService } from './services/reservation-no-show.service';
import { ReservationPricingService } from './pricing/reservation-pricing.service';
import { ReservationQueryService } from './services/reservation-query.service';
import { ReservationStatusService } from './services/reservation-status.service';
import { ReservationStorageService } from './services/reservation-storage.service';
import { ReservationAutoCompleteService } from './services/reservation-auto-complete.service';

@Module({
  imports: [AuthModule, CouponsModule, NotificationsModule],
  controllers: [
    ReservationsController,
    CustomerReservationsController,
    GuestReservationsController,
  ],
  providers: [
    GuestReservationService,
    LuggagePhotoService,
    QrCheckinService,
    ReservationPricingService,
    ReservationQueryService,
    ReservationCommandService,
    ReservationNoShowService,
    ReservationStatusService,
    ReservationStorageService,
    ReservationAutoCompleteService,
  ],
  exports: [ReservationNoShowService, ReservationStorageService],
})
export class ReservationsModule {}
