import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditService } from './services/audit.service';
import { ValidationLimitsService } from './services/validation-limits.service';
import { CacheService } from './services/cache.service';
import { StorageService } from './services/storage.service';
import { TenantContextService } from './services/tenant-context.service';
import { PlanLimitsService } from './services/plan-limits.service';
import { AlertService } from './services/alert.service';
import { QueryPerformanceService } from './services/query-performance.service';
import { MailerModule } from '../mailer/mailer.module';

/**
 * Módulo común que exporta servicios compartidos
 * Marcado como @Global() para que esté disponible en todos los módulos
 */
@Global()
@Module({
  imports: [ConfigModule, MailerModule],
  providers: [
    AuditService,
    ValidationLimitsService,
    CacheService,
    StorageService,
    TenantContextService,
    PlanLimitsService,
    AlertService,
    QueryPerformanceService,
  ],
  exports: [
    AuditService,
    ValidationLimitsService,
    CacheService,
    StorageService,
    TenantContextService,
    PlanLimitsService,
    AlertService,
    QueryPerformanceService,
  ],
})
export class CommonModule {}
