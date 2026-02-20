import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsAlertsService } from './metrics-alerts.service';
import { MetricsAlertsScheduler } from './metrics-alerts.scheduler';
import { BusinessMetricsService } from './business-metrics.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule, CommonModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsAlertsService,
    MetricsAlertsScheduler,
    BusinessMetricsService,
  ],
  exports: [MetricsService, MetricsAlertsService, BusinessMetricsService],
})
export class MetricsModule {}
