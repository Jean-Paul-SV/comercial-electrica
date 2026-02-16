import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsAlertsService } from './metrics-alerts.service';
import { MetricsAlertsScheduler } from './metrics-alerts.scheduler';
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
  ],
  exports: [MetricsService, MetricsAlertsService],
})
export class MetricsModule {}
