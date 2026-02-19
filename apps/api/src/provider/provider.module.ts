import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { DianModule } from '../dian/dian.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { UsageModule } from '../usage/usage.module';
import { BackupsModule } from '../backups/backups.module';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [PrismaModule, BillingModule, DianModule, FeedbackModule, UsageModule, BackupsModule],
  controllers: [ProviderController],
  providers: [ProviderService, PlatformAdminGuard],
  exports: [ProviderService],
})
export class ProviderModule {}
