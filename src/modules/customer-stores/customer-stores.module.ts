import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { CustomerStoresController } from './customer-stores.controller';
import { CustomerStoresService } from './customer-stores.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerStoresController],
  providers: [CustomerStoresService],
})
export class CustomerStoresModule {}
