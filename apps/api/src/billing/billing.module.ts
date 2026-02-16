import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingPortalController } from './billing-portal.controller';
import { BillingService } from './billing.service';
import { StripeWebhookProcessor } from './stripe-webhook.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [BillingController, BillingPortalController],
  providers: [BillingService, StripeWebhookProcessor],
  exports: [BillingService],
})
export class BillingModule {}
