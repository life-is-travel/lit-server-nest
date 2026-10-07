import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffService } from './staff.service';
import { StoreStaffController } from './store-staff.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StoreStaffController, StaffAuthController],
  providers: [StaffService],
})
export class StaffModule {}
