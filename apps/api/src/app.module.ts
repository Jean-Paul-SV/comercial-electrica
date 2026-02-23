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
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SupplierInvoicesModule } from './supplier-invoices/supplier-invoices.module';
import { InventoryModule } from './inventory/inventory.module';
import { CashModule } from './cash/cash.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SalesModule } from './sales/sales.module';
import { ReturnsModule } from './returns/returns.module';
import { QuotesModule } from './quotes/quotes.module';
import { ReportsModule } from './reports/reports.module';
import { DianModule } from './dian/dian.module';
import { CommonModule } from './common/common.module';
import { BackupsModule } from './backups/backups.module';
import { AuditModule } from './audit/audit.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ProviderModule } from './provider/provider.module';
import { BillingModule } from './billing/billing.module';
import { FeedbackModule } from './feedback/feedback.module';
import { UsageModule } from './usage/usage.module';
import { TrackingModule } from './tracking/tracking.module';
import { validateEnv } from './config/env.validation';
import { MetricsModule } from './metrics/metrics.module';
import { RequestMetricsInterceptor } from './metrics/request-metrics.interceptor';
import { AuditContextInterceptor } from './common/interceptors/audit-context.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { TenantContextInterceptor } from './auth/tenant-context.interceptor';
import { MailerModule } from './mailer/mailer.module';
import { PayuModule } from './payu/payu.module';
import { ConfigValidationModule } from './common/config/config-validation.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Cargar .env desde la raíz del proyecto
      envFilePath: [
        resolve(process.cwd(), '../../.env'), // Desde apps/api/
        resolve(process.cwd(), '../.env'), // Desde apps/
        resolve(process.cwd(), '.env'), // Desde raíz
      ],
      // En Vercel/serverless no hay .env; las variables vienen de process.env.
      // Fusionar process.env para que validateEnv las vea.
      validate: (config) =>
        validateEnv({ ...process.env, ...config } as Record<string, unknown>),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minuto
        limit: 1000, // 1000 requests por minuto (evita 429 con múltiples pestañas y listas)
      },
      {
        name: 'medium',
        ttl: 600000, // 10 minutos
        limit: 5000, // 5000 requests por 10 minutos (uso normal con listas y reportes)
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hora
        limit: 20000, // 20000 requests por hora
      },
      {
        name: 'login',
        ttl: 60000, // 1 minuto
        limit: 50, // 50 intentos por minuto por IP (protección contra fuerza bruta; si no se resetea, usar THROTTLE_LOGIN_DISABLED=true)
      },
      {
        name: 'forgot',
        ttl: 900000, // 15 minutos
        limit: 3, // 3 solicitudes de olvidé contraseña por 15 min por email
      },
      {
        name: 'reports',
        ttl: 60000, // 1 minuto
        limit: 30, // 30 requests de reportes por minuto por usuario
      },
      {
        name: 'export',
        ttl: 60000, // 1 minuto
        limit: 10, // 10 exports por minuto por usuario (protección contra abuso)
      },
      {
        name: 'publicIp',
        ttl: 60000, // 1 minuto
        limit: 30, // 30 req/min por IP en endpoints públicos (registro, reset, etc.)
      },
      {
        name: 'bootstrap',
        ttl: 3600000, // 1 hora
        limit: 5, // 5 intentos por hora por IP (solo para bootstrap-admin)
      },
    ]),
    ScheduleModule.forRoot(),
    MailerModule,
    PayuModule,
    CommonModule,
    MetricsModule,
    PrismaModule,
    QueueModule,
    AuthModule,
    CatalogModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    SupplierInvoicesModule,
    InventoryModule,
    CashModule,
    ExpensesModule,
    SalesModule,
    ReturnsModule,
    QuotesModule,
    ReportsModule,
    DianModule,
    BackupsModule,
    AuditModule,
    OnboardingModule,
    ProviderModule,
    BillingModule,
    FeedbackModule,
    UsageModule,
    TrackingModule,
    TenantModule,
    ConfigValidationModule, // Validar configuración después de ConfigModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuditContextInterceptor,
    RequestMetricsInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottleAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestMetricsInterceptor,
    },
  ],
  exports: [AppService],
})
export class AppModule {}
