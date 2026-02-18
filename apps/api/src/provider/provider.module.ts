import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { DianModule } from '../dian/dian.module';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [PrismaModule, BillingModule, DianModule],
  controllers: [ProviderController],
  providers: [ProviderService, PlatformAdminGuard],
  exports: [ProviderService],
})
export class ProviderModule {}
