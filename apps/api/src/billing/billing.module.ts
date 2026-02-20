import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingPortalController } from './billing-portal.controller';
import { BillingService } from './billing.service';
import { BillingScheduler } from './billing-scheduler';
import { StripeWebhookProcessor } from './stripe-webhook.processor';
import { StripeReconciliationScheduler } from './stripe-reconciliation.scheduler';
import { WompiController } from './wompi/wompi.controller';
import { WompiService } from './wompi/wompi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { CommonModule } from '../common/common.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [PrismaModule, QueueModule, CommonModule, MailerModule],
  controllers: [BillingController, BillingPortalController, WompiController],
  providers: [
    BillingService,
    WompiService,
    BillingScheduler,
    StripeWebhookProcessor,
    StripeReconciliationScheduler,
  ],
  exports: [BillingService, WompiService],
})
export class BillingModule {}
