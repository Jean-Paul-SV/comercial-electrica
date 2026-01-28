import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { resolve } from 'path';
import { ThrottleAuthGuard } from './common/guards/throttle-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { CashModule } from './cash/cash.module';
import { SalesModule } from './sales/sales.module';
import { QuotesModule } from './quotes/quotes.module';
import { ReportsModule } from './reports/reports.module';
import { DianModule } from './dian/dian.module';
import { CommonModule } from './common/common.module';
import { BackupsModule } from './backups/backups.module';
import { AuditModule } from './audit/audit.module';
import { validateEnv } from './config/env.validation';
import { MetricsModule } from './metrics/metrics.module';
import { RequestMetricsInterceptor } from './metrics/request-metrics.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Cargar .env desde la raíz del proyecto
      // Intenta diferentes ubicaciones posibles
      envFilePath: [
        resolve(process.cwd(), '../../.env'), // Desde apps/api/
        resolve(process.cwd(), '../.env'), // Desde apps/
        resolve(process.cwd(), '.env'), // Desde raíz
      ],
      validate: (config) => validateEnv(config as Record<string, unknown>),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
      {
        name: 'medium',
        ttl: 600000, // 10 minutos
        limit: 500, // 500 requests por 10 minutos
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hora
        limit: 1000, // 1000 requests por hora
      },
    ]),
    ScheduleModule.forRoot(),
    CommonModule,
    MetricsModule,
    PrismaModule,
    QueueModule,
    AuthModule,
    CatalogModule,
    CustomersModule,
    InventoryModule,
    CashModule,
    SalesModule,
    QuotesModule,
    ReportsModule,
    DianModule,
    BackupsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RequestMetricsInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottleAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestMetricsInterceptor,
    },
  ],
  exports: [AppService],
})
export class AppModule {}
