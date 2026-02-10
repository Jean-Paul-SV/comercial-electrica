import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingPortalController } from './billing-portal.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, BillingPortalController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
